/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { deprecated } from '@wordpress/utils';

/**
 * Internal dependencies
 */
import MediaUpload from './media-upload';

const replaceMediaUpload = () => MediaUpload;

addFilter(
	'components.MediaUpload',
	'core/edit-post/components/media-upload/replaceMediaUpload',
	replaceMediaUpload
);

// Deprecated hooks
addFilter(
	'blocks.MediaUpload',
	'core/edit-post/media-upload/with-deprecation-notice',
	() => {
		deprecated( 'blocks.MediaUpload', {
			version: '2.7',
			alternative: 'components.MediaUpload',
			plugin: 'Gutenberg',
		} );
		return replaceMediaUpload();
	}
);
