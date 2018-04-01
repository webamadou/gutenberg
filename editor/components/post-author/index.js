/**
 * External dependencies
 */
import { connect } from 'react-redux';
import { throttle, find } from 'lodash';
import Select from 'react-select';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withAPIData, withInstanceId } from '@wordpress/components';
import { Component, compose } from '@wordpress/element';

/**
 * Internal dependencies
 */
import PostAuthorCheck from './check';
import { getEditedPostAttribute } from '../../store/selectors';
import { editPost } from '../../store/actions';
import './style.scss';

export class PostAuthor extends Component {
	constructor() {
		super( ...arguments );
		this.fetchAuthors = throttle( this.fetchAuthors.bind( this ), 300 );

		this.setAuthorId = this.setAuthorId.bind( this );
		this.state = {
			searchusers: [],
		};
	}

	// When an author is selected, set the post author.
	setAuthorId( value ) {
		if ( ! value ) {
			return;
		}
		const { onUpdateAuthor } = this.props;
		onUpdateAuthor( Number( value.id ) );
	}

	// Get the list of authors, returns default values or last search.
	getAuthors() {
		const { users, postAuthor } = this.props;
		const { searchusers } = this.state;
		const hasSearchResults = ( 0 !== searchusers.length );

		if ( ! users.data ) {
			users.data = [];
		}

		const allUsers = hasSearchResults ? searchusers : users.data;

		// If the postAuthor user isn't found in the default ids, load it.
		if ( ! hasSearchResults && ! find( allUsers, { id: postAuthor } ) ) {
			const request = wp.apiRequest( { path: '/wp/v2/users/' + postAuthor + '?context=edit' } );
			request.then( ( response ) => {
				this.setState( { searchusers: [ response ] } );
			} );
		} else {
			return allUsers;
		}
	}

	// Fetch authors from the REST API.
	fetchAuthors( query ) {
		// If the query is blank, return the default user list.
		if ( ! query ) {
			return Promise.resolve( { options: this.getAuthors() } );
		}
		const request = wp.apiRequest( { path: '/wp/v2/users?context=edit&_fields=name,id&search=' + encodeURIComponent( query ) } );

		// Return a promise that resolves with the user search results.
		return request.then( ( response ) => {
			this.setState( { searchusers: response } );
			return { options: response };
		} );
	}

	render() {
		const { postAuthor, instanceId } = this.props;
		const selectId = 'post-author-selector-' + instanceId;
		const authors = this.getAuthors();

		// Don't display component until authors have loaded.
		if ( ! authors ) {
			return null;
		}

		/* eslint-disable jsx-a11y/no-onchange */
		return (
			<PostAuthorCheck>
				<label htmlFor={ selectId }>{ __( 'Author' ) }</label>
				<Select.Async
					id={ selectId }
					multi={ false }
					value={ postAuthor }
					onChange={ this.setAuthorId }
					valueKey="id"
					labelKey="name"
					loadOptions={ this.fetchAuthors }
					backspaceRemoves={ false }
					options={ authors }
					autoload={ false }
					clearable={ false }
					onBlurResetsInput={ false }
					onCloseResetsInput={ false }
				/>
			</PostAuthorCheck>
		);
		/* eslint-enable jsx-a11y/no-onchange */
	}
}

const applyConnect = connect(
	( state ) => {
		return {
			postAuthor: getEditedPostAttribute( state, 'author' ),
		};
	},
	{
		onUpdateAuthor( author ) {
			return editPost( { author } );
		},
	},
);

const applyWithAPIData = withAPIData( () => {
	return {
		users: '/wp/v2/users?context=edit&per_page=100',
	};
} );

export default compose( [
	applyConnect,
	applyWithAPIData,
	withInstanceId,
] )( PostAuthor );
