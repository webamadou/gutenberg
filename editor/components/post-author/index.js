/**
 * External dependencies
 */
import { connect } from 'react-redux';
import { filter, unescape as unescapeString, throttle, union, find } from 'lodash';
import Select from 'react-select';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { FormTokenField, withAPIData, withInstanceId } from '@wordpress/components';
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

	setAuthorId( value ) {
		if ( ! value ) {
		//	return;
		}
		const { onUpdateAuthor } = this.props;
		onUpdateAuthor( Number( value.id ) );
	}

	getAuthors() {
		const { users, postAuthor } = this.props;
		const { searchusers } = this.state;
		if ( ! users.data ) {
			users.data = [];
		}
		console.log( 'getAuthors',searchusers );
		console.log( 'getAuthors',searchusers );
		const allUsers = union( users.data, searchusers );
		/*if ( ! find( allUsers, { id: postAuthor } ) ) {
			const request = wp.apiRequest( { path: '/wp/v2/users/' + postAuthor + '?context=edit&_fields=name,id' } );
			request.then( ( response ) => {
				return union( response, allUsers );
			} );
		} else {
		}
		*/
				return allUsers;
}

	fetchAuthors( query ) {
		//console.log('query', query);
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
console.log( 'postAuthor', postAuthor );
		if ( ! authors || 0 === authors.length ) {
			return false;
		}
console.log( 'authors', authors );
		/* eslint-disable jsx-a11y/no-onchange */
		return (
			<PostAuthorCheck>
				<label htmlFor={ selectId }>{ __( 'Author' ) }</label>
				<Select.Async
					id={selectId}
					multi={false}
					value={ postAuthor }
					onChange={ this.setAuthorId }
					valueKey="id"
					labelKey="name"
					loadOptions={ this.fetchAuthors }
					backspaceRemoves={false}
					options={ authors }
					autoload={ true }
					value={ postAuthor }
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
		users: '/wp/v2/users?context=edit&_fields=name,id',
	};
} );

export default compose( [
	applyConnect,
	applyWithAPIData,
	withInstanceId,
] )( PostAuthor );
