/**
 * External dependencies
 */
import { isEmpty } from 'lodash';

/**
 * WordPress dependencies
 */
import { withContext } from '@wordpress/components';

export default withContext( 'editor' )(
	( { colors, disableCustomColors } ) => {
		return {
			colors,
			disableCustomColors,
			hasColorsToChoose: ! isEmpty( colors ) || ! disableCustomColors,
		};
	}
)( ( { children, ...props } ) => children( props ) );
