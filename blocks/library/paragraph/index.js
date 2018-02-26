/**
 * External dependencies
 */
import classnames from 'classnames';
import { findKey, isFinite, map, omit } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { concatChildren, Component, RawHTML } from '@wordpress/element';
import {
	Autocomplete,
	PanelBody,
	PanelColor,
	RangeControl,
	ToggleControl,
	Button,
	ButtonGroup,
	withFallbackStyles,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import './editor.scss';
import './style.scss';
import { createBlock } from '../../api';
import { blockAutocompleter, userAutocompleter } from '../../autocompleters';
import AlignmentToolbar from '../../alignment-toolbar';
import BlockAlignmentToolbar from '../../block-alignment-toolbar';
import BlockControls from '../../block-controls';
import RichText from '../../rich-text';
import InspectorControls from '../../inspector-controls';
import ColorPalette from '../../color-palette';
import ContrastChecker from '../../contrast-checker';
import { getColorClass, withColors } from '../../colors';

const { getComputedStyle } = window;

const ContrastCheckerWithFallbackStyles = withFallbackStyles( ( node, ownProps ) => {
	const { textColor, backgroundColor } = ownProps;
	//avoid the use of querySelector if both colors are known and verify if node is available.
	const editableNode = ( ! textColor || ! backgroundColor ) && node ? node.querySelector( '[contenteditable="true"]' ) : null;
	//verify if editableNode is available, before using getComputedStyle.
	const computedStyles = editableNode ? getComputedStyle( editableNode ) : null;
	return {
		fallbackBackgroundColor: backgroundColor || ! computedStyles ? undefined : computedStyles.backgroundColor,
		fallbackTextColor: textColor || ! computedStyles ? undefined : computedStyles.color,
	};
} )( ContrastChecker );

const FONT_SIZES = {
	small: 14,
	regular: 16,
	large: 36,
	larger: 48,
};

class ParagraphBlock extends Component {
	constructor() {
		super( ...arguments );
		this.nodeRef = null;
		this.bindRef = this.bindRef.bind( this );
		this.onReplace = this.onReplace.bind( this );
		this.toggleDropCap = this.toggleDropCap.bind( this );
		this.getFontSize = this.getFontSize.bind( this );
		this.setFontSize = this.setFontSize.bind( this );
	}

	onReplace( blocks ) {
		const { attributes, onReplace } = this.props;
		onReplace( blocks.map( ( block, index ) => (
			index === 0 && block.name === name ?
				{ ...block,
					attributes: {
						...attributes,
						...block.attributes,
					},
				} :
				block
		) ) );
	}

	toggleDropCap() {
		const { attributes, setAttributes } = this.props;
		setAttributes( { dropCap: ! attributes.dropCap } );
	}

	bindRef( node ) {
		if ( ! node ) {
			return;
		}
		this.nodeRef = node;
	}

	getFontSize() {
		const { customFontSize, fontSize } = this.props.attributes;
		if ( fontSize ) {
			return FONT_SIZES[ fontSize ];
		}

		if ( customFontSize ) {
			return customFontSize;
		}
	}

	setFontSize( fontSizeValue ) {
		const { setAttributes } = this.props;
		const thresholdFontSize = findKey( FONT_SIZES, ( size ) => size === fontSizeValue );
		if ( thresholdFontSize ) {
			setAttributes( {
				fontSize: thresholdFontSize,
				customFontSize: undefined,
			} );
			return;
		}
		setAttributes( {
			fontSize: undefined,
			customFontSize: fontSizeValue,
		} );
	}

	render() {
		const {
			attributes,
			setAttributes,
			insertBlocksAfter,
			isSelected,
			mergeBlocks,
			onReplace,
			className,
			initializeColor,
		} = this.props;

		const {
			align,
			content,
			dropCap,
			placeholder,
			width,
		} = attributes;

		const fontSize = this.getFontSize();

		const textColor = initializeColor( {
			colorContext: 'text',
			colorAttribute: 'textColor',
			customColorAttribute: 'customTextColor',
		} );
		const backgroundColor = initializeColor( {
			colorContext: 'background',
			colorAttribute: 'backgroundColor',
			customColorAttribute: 'customBackgroundColor',
		} );

		return [
			isSelected && (
				<BlockControls key="controls">
					<AlignmentToolbar
						value={ align }
						onChange={ ( nextAlign ) => {
							setAttributes( { align: nextAlign } );
						} }
					/>
				</BlockControls>
			),
			isSelected && (
				<InspectorControls key="inspector">
					<PanelBody title={ __( 'Text Settings' ) } className="blocks-font-size">
						<div className="blocks-font-size__main">
							<ButtonGroup aria-label={ __( 'Font Size' ) }>
								{ map( {
									S: 'small',
									M: 'regular',
									L: 'large',
									XL: 'larger',
								}, ( size, label ) => (
									<Button
										key={ label }
										isLarge
										isPrimary={ fontSize === FONT_SIZES[ size ] }
										aria-pressed={ fontSize === FONT_SIZES[ size ] }
										onClick={ () => this.setFontSize( FONT_SIZES[ size ] ) }
									>
										{ label }
									</Button>
								) ) }
							</ButtonGroup>
							<Button
								isLarge
								onClick={ () => this.setFontSize( undefined ) }
							>
								{ __( 'Reset' ) }
							</Button>
						</div>
						<RangeControl
							label={ __( 'Custom Size' ) }
							value={ fontSize || '' }
							onChange={ ( value ) => this.setFontSize( value ) }
							min={ 12 }
							max={ 100 }
							beforeIcon="editor-textcolor"
							afterIcon="editor-textcolor"
						/>
						<ToggleControl
							label={ __( 'Drop Cap' ) }
							checked={ !! dropCap }
							onChange={ this.toggleDropCap }
						/>
					</PanelBody>
					<PanelColor title={ __( 'Background Color' ) } colorValue={ backgroundColor.value } initialOpen={ false }>
						<ColorPalette
							value={ backgroundColor.value }
							onChange={ backgroundColor.set }
						/>
					</PanelColor>
					<PanelColor title={ __( 'Text Color' ) } colorValue={ textColor.value } initialOpen={ false }>
						<ColorPalette
							value={ textColor.value }
							onChange={ textColor.set }
						/>
					</PanelColor>
					{ this.nodeRef && <ContrastCheckerWithFallbackStyles
						node={ this.nodeRef }
						textColor={ textColor.value }
						backgroundColor={ backgroundColor.value }
						isLargeText={ fontSize >= 18 }
					/> }
					<PanelBody title={ __( 'Block Alignment' ) }>
						<BlockAlignmentToolbar
							value={ width }
							onChange={ ( nextWidth ) => setAttributes( { width: nextWidth } ) }
						/>
					</PanelBody>
				</InspectorControls>
			),
			<div key="editable" ref={ this.bindRef }>
				<Autocomplete completers={ [
					blockAutocompleter( { onReplace } ),
					userAutocompleter(),
				] }>
					{ ( { isExpanded, listBoxId, activeId } ) => (
						<RichText
							tagName="p"
							className={ classnames( 'wp-block-paragraph', className, {
								'has-background': backgroundColor.value,
								'has-drop-cap': dropCap,
								[ backgroundColor.class ]: backgroundColor.class,
								[ textColor.class ]: textColor.class,
							} ) }
							style={ {
								backgroundColor: backgroundColor.class ? undefined : backgroundColor.value,
								color: textColor.class ? undefined : textColor.value,
								fontSize: fontSize ? fontSize + 'px' : undefined,
								textAlign: align,
							} }
							value={ content }
							onChange={ ( nextContent ) => {
								setAttributes( {
									content: nextContent,
								} );
							} }
							onSplit={ insertBlocksAfter ?
								( before, after, ...blocks ) => {
									setAttributes( { content: before } );
									insertBlocksAfter( [
										...blocks,
										createBlock( 'core/paragraph', { content: after } ),
									] );
								} :
								undefined
							}
							onMerge={ mergeBlocks }
							onReplace={ this.onReplace }
							onRemove={ () => onReplace( [] ) }
							placeholder={ placeholder || __( 'Add text or type / to add content' ) }
							aria-autocomplete="list"
							aria-expanded={ isExpanded }
							aria-owns={ listBoxId }
							aria-activedescendant={ activeId }
							isSelected={ isSelected }
						/>
					) }
				</Autocomplete>
			</div>,
		];
	}
}

const supports = {
	className: false,
};

const schema = {
	content: {
		type: 'array',
		source: 'children',
		selector: 'p',
		default: [],
	},
	align: {
		type: 'string',
	},
	dropCap: {
		type: 'boolean',
		default: false,
	},
	placeholder: {
		type: 'string',
	},
	width: {
		type: 'string',
	},
	textColor: {
		type: 'string',
	},
	customTextColor: {
		type: 'string',
	},
	backgroundColor: {
		type: 'string',
	},
	customBackgroundColor: {
		type: 'string',
	},
	fontSize: {
		type: 'string',
	},
	customFontSize: {
		type: 'number',
	},
};

export const name = 'core/paragraph';

export const settings = {
	title: __( 'Paragraph' ),

	description: __( 'This is a simple text only block for adding a single paragraph of content.' ),

	icon: 'editor-paragraph',

	category: 'common',

	keywords: [ __( 'text' ) ],

	supports,

	attributes: schema,

	transforms: {
		from: [
			{
				type: 'raw',
				priority: 20,
				isMatch: ( node ) => (
					node.nodeName === 'P' &&
					// Do not allow embedded content.
					! node.querySelector( 'audio, canvas, embed, iframe, img, math, object, svg, video' )
				),
			},
		],
	},

	deprecated: [
		{
			supports,
			attributes: omit( {
				...schema,
				fontSize: {
					type: 'number',
				},
			}, 'customFontSize' ),
			save( { attributes } ) {
				const { width, align, content, dropCap, backgroundColor, textColor, fontSize } = attributes;
				const className = classnames( {
					[ `align${ width }` ]: width,
					'has-background': backgroundColor,
					'has-drop-cap': dropCap,
				} );
				const styles = {
					backgroundColor: backgroundColor,
					color: textColor,
					fontSize: fontSize,
					textAlign: align,
				};

				return <p style={ styles } className={ className ? className : undefined }>{ content }</p>;
			},
			migrate( attributes ) {
				if ( isFinite( attributes.fontSize ) ) {
					return omit( {
						...attributes,
						customFontSize: attributes.fontSize,
					}, 'fontSize' );
				}
				return attributes;
			},
		},
		{
			supports,
			attributes: {
				...schema,
				content: {
					type: 'string',
					source: 'html',
				},
			},
			save( { attributes } ) {
				return <RawHTML>{ attributes.content }</RawHTML>;
			},
			migrate( attributes ) {
				return {
					...attributes,
					content: [
						<RawHTML key="html">{ attributes.content }</RawHTML>,
					],
				};
			},
		},
	],

	merge( attributes, attributesToMerge ) {
		return {
			content: concatChildren( attributes.content, attributesToMerge.content ),
		};
	},

	getEditWrapperProps( attributes ) {
		const { width } = attributes;
		if ( [ 'wide', 'full', 'left', 'right' ].indexOf( width ) !== -1 ) {
			return { 'data-align': width };
		}
	},

	edit: withColors( ParagraphBlock ),

	save( { attributes } ) {
		const {
			width,
			align,
			content,
			dropCap,
			backgroundColor,
			textColor,
			customBackgroundColor,
			customTextColor,
			fontSize,
			customFontSize,
		} = attributes;

		const textClass = getColorClass( 'text', textColor );
		const backgroundClass = getColorClass( 'background', backgroundColor );
		const fontSizeClass = fontSize && FONT_SIZES[ fontSize ] && `is-${ fontSize }-text`;

		const className = classnames( {
			[ `align${ width }` ]: width,
			'has-background': backgroundColor || customBackgroundColor,
			'has-drop-cap': dropCap,
			[ fontSizeClass ]: fontSizeClass,
			[ textClass ]: textClass,
			[ backgroundClass ]: backgroundClass,
		} );

		const styles = {
			backgroundColor: backgroundClass ? undefined : customBackgroundColor,
			color: textClass ? undefined : customTextColor,
			fontSize: fontSizeClass ? undefined : customFontSize,
			textAlign: align,
		};

		return <p style={ styles } className={ className ? className : undefined }>{ content }</p>;
	},
};
