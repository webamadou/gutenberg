/**
 * External dependencies
 */
import { parse } from 'url';
import { includes, kebabCase, toLower } from 'lodash';
import { stringify } from 'querystring';
import memoize from 'memize';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Component, renderToString } from '@wordpress/element';
import { Button, Placeholder, Spinner, SandBox } from '@wordpress/components';
import classnames from 'classnames';

/**
 * Internal dependencies
 */
import './style.scss';
import './editor.scss';
import { createBlock } from '../../api';
import RichText from '../../rich-text';
import BlockControls from '../../block-controls';
import BlockAlignmentToolbar from '../../block-alignment-toolbar';

// These embeds do not work in sandboxes
const HOSTS_NO_PREVIEWS = [ 'facebook.com' ];

// Caches the embed API calls, so if blocks get transformed, or deleted and added again, we don't spam the API.
const wpEmbedAPI = memoize( ( url ) => wp.apiRequest( { path: `/oembed/1.0/proxy?${ stringify( { url } ) }` } ) );

// A map of block names to URL patterns, so we can find which block should handle a URL.
const blockPatterns = {};

const matchesPatterns = ( url, patterns ) => {
	return patterns.some( ( pattern ) => {
		return url.match( new RegExp( pattern, 'i' ) );
	} );
};

const findBlock = ( url ) => {
	for ( const blockName in blockPatterns ) {
		if ( matchesPatterns( url, blockPatterns[ blockName ] ) ) {
			return blockName;
		}
	}
	return 'core/embed';
};

function getEmbedBlockSettings( { title, icon, category = 'embed', transforms, keywords = [], patterns = [] } ) {
	return {
		title,

		description: __( 'The Embed block allows you to easily add videos, images, tweets, audio, and other content to your post or page.' ),

		icon,

		category,

		keywords,

		attributes: {
			url: {
				type: 'string',
			},
			caption: {
				type: 'array',
				source: 'children',
				selector: 'figcaption',
				default: [],
			},
			align: {
				type: 'string',
			},
			type: {
				type: 'string',
			},
			providerNameSlug: {
				type: 'string',
			},
		},

		transforms,

		getEditWrapperProps( attributes ) {
			const { align } = attributes;
			if ( 'left' === align || 'right' === align || 'wide' === align || 'full' === align ) {
				return { 'data-align': align };
			}
		},

		edit: class extends Component {
			constructor() {
				super( ...arguments );
				this.doServerSideRender = this.doServerSideRender.bind( this );
				this.state = {
					html: '',
					type: '',
					error: false,
					fetching: false,
					providerName: '',
				};
			}

			componentWillMount() {
				if ( this.props.attributes.url ) {
					// if the url is already there, we're loading a saved block, so we need to render
					// a different thing, which is why this doesn't use 'fetching', as that
					// is for when the user is putting in a new url on the placeholder form
					this.setState( { fetching: true } );
					this.doServerSideRender();
				}
			}

			componentWillUnmount() {
				// can't abort the fetch promise, so let it know we will unmount
				this.unmounting = true;
			}

			getPhotoHtml( photo ) {
				// 100% width for the preview so it fits nicely into the document, some "thumbnails" are
				// acually the full size photo.
				const photoPreview = <p><img src={ photo.thumbnail_url } alt={ photo.title } width="100%" /></p>;
				return renderToString( photoPreview );
			}

			doServerSideRender( event ) {
				if ( event ) {
					event.preventDefault();
				}
				const { url } = this.props.attributes;
				const { setAttributes } = this.props;

				// If we don't have any URL patterns, or we do and the URL doesn't match,
				// then we should look for a block that has a matching URL pattern.
				if ( ! patterns || ( patterns && ! matchesPatterns( url, patterns ) ) ) {
					const matchingBlock = findBlock( url );
					// WordPress blocks can work on multiple sites, and so don't have patterns,
					// so if we're in a WordPress block, assume the user has chosen it for a WordPress URL.
					if ( 'core-embed/wordpress' !== this.props.name && 'core/embed' !== matchingBlock ) {
						// At this point, we have discovered a more suitable block for this url, so transform it.
						if ( this.props.name !== matchingBlock ) {
							this.props.onReplace( createBlock( matchingBlock, { url } ) );
							return;
						}
					}
				}

				this.setState( { error: false, fetching: true } );
				wpEmbedAPI( url )
					.then(
						( obj ) => {
							if ( this.unmounting ) {
								return;
							}
							// Some plugins put the embed html in `result`, so get the right one here.
							const html = obj.html ? obj.html : obj.result;
							// Some plugins only return HTML with no type info, so default this to 'rich'.
							let { type = 'rich' } = obj;
							// If we got a provider name from the API, use it for the slug, otherwise we use the title,
							// because not all embed code gives us a provider name.
							const { provider_name: providerName } = obj;
							const providerNameSlug = kebabCase( toLower( '' !== providerName ? providerName : title ) );

							// This indicates it's a WordPress embed, there aren't a set of URL patterns we can use to match WordPress URLs.
							if ( includes( html, 'class="wp-embedded-content" data-secret' ) ) {
								type = 'wp-embed';
								// If this is not the WordPress embed block, transform it into one.
								if ( this.props.name !== 'core-embed/wordpress' ) {
									this.props.onReplace( createBlock( 'core-embed/wordpress', { url } ) );
									return;
								}
							}
							if ( html ) {
								this.setState( { html, type, providerNameSlug } );
								setAttributes( { type, providerNameSlug } );
							} else if ( 'photo' === type ) {
								this.setState( { html: this.getPhotoHtml( obj ), type, providerNameSlug } );
								setAttributes( { type, providerNameSlug } );
							}
							this.setState( { fetching: false } );
						},
						() => {
							this.setState( { fetching: false, error: true } );
						}
					);
			}

			render() {
				const { html, type, error, fetching } = this.state;
				const { align, url, caption } = this.props.attributes;
				const { setAttributes, isSelected, className } = this.props;
				const updateAlignment = ( nextAlign ) => setAttributes( { align: nextAlign } );

				const controls = isSelected && (
					<BlockControls key="controls">
						<BlockAlignmentToolbar
							value={ align }
							onChange={ updateAlignment }
						/>
					</BlockControls>
				);

				if ( fetching ) {
					return [
						controls,
						<div key="loading" className="wp-block-embed is-loading">
							<Spinner />
							<p>{ __( 'Embedding…' ) }</p>
						</div>,
					];
				}

				if ( ! html ) {
					const label = sprintf( __( '%s URL' ), title );

					return [
						controls,
						<Placeholder key="placeholder" icon={ icon } label={ label } className="wp-block-embed">
							<form onSubmit={ this.doServerSideRender }>
								<input
									type="url"
									value={ url || '' }
									className="components-placeholder__input"
									aria-label={ label }
									placeholder={ __( 'Enter URL to embed here…' ) }
									onChange={ ( event ) => setAttributes( { url: event.target.value } ) } />
								<Button
									isLarge
									type="submit">
									{ __( 'Embed' ) }
								</Button>
								{ error && <p className="components-placeholder__error">{ __( 'Sorry, we could not embed that content.' ) }</p> }
							</form>
						</Placeholder>,
					];
				}

				const parsedUrl = parse( url );
				const cannotPreview = includes( HOSTS_NO_PREVIEWS, parsedUrl.host.replace( /^www\./, '' ) );
				const iframeTitle = sprintf( __( 'Embedded content from %s' ), parsedUrl.host );
				const embedWrapper = 'wp-embed' === type ? (
					<div
						className="wp-block-embed__wrapper"
						dangerouslySetInnerHTML={ { __html: html } }
					/>
				) : (
					<div className="wp-block-embed__wrapper">
						<SandBox
							html={ html }
							title={ iframeTitle }
							type={ type }
						/>
					</div>
				);

				return [
					controls,
					<figure key="embed" className={ classnames( className, { 'is-video': 'video' === type } ) }>
						{ ( cannotPreview ) ? (
							<Placeholder icon={ icon } label={ __( 'Embed URL' ) }>
								<p className="components-placeholder__error"><a href={ url }>{ url }</a></p>
								<p className="components-placeholder__error">{ __( 'Previews for this are unavailable in the editor, sorry!' ) }</p>
							</Placeholder>
						) : embedWrapper }
						{ ( caption && caption.length > 0 ) || isSelected ? (
							<RichText
								tagName="figcaption"
								placeholder={ __( 'Write caption…' ) }
								value={ caption }
								onChange={ ( value ) => setAttributes( { caption: value } ) }
								isSelected={ isSelected }
								inlineToolbar
							/>
						) : null }
					</figure>,
				];
			}
		},

		save( { attributes } ) {
			const { url, caption, align, type, providerNameSlug } = attributes;

			if ( ! url ) {
				return null;
			}

			const embedClassName = classnames( 'wp-block-embed', {
				[ `align${ align }` ]: align,
				[ `is-type-${ type }` ]: type,
				[ `is-provider-${ providerNameSlug }` ]: providerNameSlug,
			} );

			return (
				<figure className={ embedClassName }>
					{ `\n${ url }\n` /* URL needs to be on its own line. */ }
					{ caption && caption.length > 0 && <figcaption>{ caption }</figcaption> }
				</figure>
			);
		},
	};
}

export const name = 'core/embed';

export const settings = getEmbedBlockSettings( {
	title: __( 'Embed' ),
	icon: 'embed-generic',
	transforms: {
		from: [
			{
				type: 'raw',
				isMatch: ( node ) => node.nodeName === 'P' && /^\s*(https?:\/\/\S+)\s*$/i.test( node.textContent ),
				transform: ( node ) => {
					return createBlock( 'core/embed', {
						url: node.textContent.trim(),
					} );
				},
			},
		],
	},
} );

function getEmbedBlockDefinition( options ) {
	// Register the patterns for this block. They're separate from the settings to keep non-standard fields out of settings.
	if ( options.patterns && options.patterns.length > 0 ) {
		blockPatterns[ options.name ] = options.patterns;
	}
	return {
		name: options.name,
		settings: getEmbedBlockSettings( { ...options.settings, patterns: options.patterns } ),
	};
}

export const common = [
	getEmbedBlockDefinition( {
		name: 'core-embed/twitter',
		settings: {
			title: 'Twitter',
			icon: 'embed-post',
			keywords: [ __( 'tweet' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?twitter\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/youtube',
		settings: {
			title: 'YouTube',
			icon: 'embed-video',
			keywords: [ __( 'music' ), __( 'video' ) ],
		},
		patterns: [ '^https?:\/\/((m|www)\.)?youtube\.com\/.+', 'youtu\.be\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/facebook',
		settings: {
			title: 'Facebook',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/www\.facebook.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/instagram',
		settings: {
			title: 'Instagram',
			icon: 'embed-photo',
			keywords: [ __( 'image' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?instagr(\.am|am\.com)/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/wordpress',
		settings: {
			title: 'WordPress',
			icon: 'embed-post',
			keywords: [ __( 'post' ), __( 'blog' ) ],
		},
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/soundcloud',
		settings: {
			title: 'SoundCloud',
			icon: 'embed-audio',
			keywords: [ __( 'music' ), __( 'audio' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?soundcloud\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/spotify',
		settings: {
			title: 'Spotify',
			icon: 'embed-audio',
			keywords: [ __( 'music' ), __( 'audio' ) ],
		},
		patterns: [ '^https?:\/\/(open|play)\.spotify\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/flickr',
		settings: {
			title: 'Flickr',
			icon: 'embed-photo',
			keywords: [ __( 'image' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?flickr\.com\/.+', 'flic\.kr/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/vimeo',
		settings: {
			title: 'Vimeo',
			icon: 'embed-video',
			keywords: [ __( 'video' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?vimeo\.com\/.+' ],
	} ),
];

export const others = [
	getEmbedBlockDefinition( {
		name: 'core-embed/animoto',
		settings: {
			title: 'Animoto',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.)?(animoto|video214)\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/cloudup',
		settings: {
			title: 'Cloudup',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/cloudup\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/collegehumor',
		settings: {
			title: 'CollegeHumor',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.)?collegehumor\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/dailymotion',
		settings: {
			title: 'Dailymotion',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.)?dailymotion\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/funnyordie',
		settings: {
			title: 'Funny or Die',
			icon: 'embed-video',
		},
		patterns: [ '(www\.)?funnyordie\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/hulu',
		settings: {
			title: 'Hulu',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.)?hulu\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/imgur',
		settings: {
			title: 'Imgur',
			icon: 'embed-photo',
		},
		patterns: [ '^https?:\/\/(.+\.)?imgur\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/issuu',
		settings: {
			title: 'Issuu',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?issuu\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/kickstarter',
		settings: {
			title: 'Kickstarter',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?kickstarter\.com\/.+', '^https?:\/\/kck\.st/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/meetup-com',
		settings: {
			title: 'Meetup.com',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?meetu(\.ps|p\.com)\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/mixcloud',
		settings: {
			title: 'Mixcloud',
			icon: 'embed-audio',
			keywords: [ __( 'music' ), __( 'audio' ) ],
		},
		patterns: [ '^https?:\/\/(www\.)?mixcloud\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/photobucket',
		settings: {
			title: 'Photobucket',
			icon: 'embed-photo',
		},
		patterns: [ '^http:\/\/g?i*\.photobucket\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/polldaddy',
		settings: {
			title: 'Polldaddy',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?mixcloud\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/reddit',
		settings: {
			title: 'Reddit',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?reddit\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/reverbnation',
		settings: {
			title: 'ReverbNation',
			icon: 'embed-audio',
		},
		patterns: [ '^https?:\/\/(www\.)?reverbnation\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/screencast',
		settings: {
			title: 'Screencast',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.)?screencast\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/scribd',
		settings: {
			title: 'Scribd',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?scribd\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/slideshare',
		settings: {
			title: 'Slideshare',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(.+?\.)?slideshare\.net\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/smugmug',
		settings: {
			title: 'SmugMug',
			icon: 'embed-photo',
		},
		patterns: [ '^https?:\/\/(www\.)?smugmug\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/speaker',
		settings: {
			title: 'Speaker',
			icon: 'embed-audio',
		},
		patterns: [ '^https?:\/\/(www\.)?speakerdeck\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/ted',
		settings: {
			title: 'TED',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/(www\.|embed\.)?ted\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/tumblr',
		settings: {
			title: 'Tumblr',
			icon: 'embed-post',
		},
		patterns: [ '^https?:\/\/(www\.)?tumblr\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/videopress',
		settings: {
			title: 'VideoPress',
			icon: 'embed-video',
			keywords: [ __( 'video' ) ],
		},
		patterns: [ '^https?:\/\/videopress\.com\/.+' ],
	} ),
	getEmbedBlockDefinition( {
		name: 'core-embed/wordpress-tv',
		settings: {
			title: 'WordPress.tv',
			icon: 'embed-video',
		},
		patterns: [ '^https?:\/\/wordpress\.tv\/.+' ],
	} ),
];
