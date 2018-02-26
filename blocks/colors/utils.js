/**
 * External dependencies
 */
import { find, kebabCase } from 'lodash';

export const getColorValue = ( colors, namedColor, customColor ) => {
	if ( namedColor ) {
		const colorObj = find( colors, { name: namedColor } );
		return colorObj && colorObj.color;
	}
	if ( customColor ) {
		return customColor;
	}
};

export const setColorValue = ( colors, colorAttributeName, customColorAttributeName, setAttributes ) =>
	( colorValue ) => {
		const colorObj = find( colors, { color: colorValue } );
		setAttributes( {
			[ colorAttributeName ]: colorObj ? colorObj.name : undefined,
			[ customColorAttributeName ]: colorObj ? undefined : colorValue,
		} );
	};

/**
 * Returns a class based on the context a color is being used and its name.
 *
 * @param {string} colorContextName Context/place where color is being used e.g: background, text etc...
 * @param {string} colorName        Name of the color.
 *
 * @return {string} String with the class corresponding to the color in the provided context.
 */
export function getColorClass( colorContextName, colorName ) {
	if ( ! colorContextName || ! colorName ) {
		return;
	}

	return `has-${ kebabCase( colorName ) }-${ colorContextName }-color`;
}
