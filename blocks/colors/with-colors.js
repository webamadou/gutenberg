/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * WordPress dependencies
 */
import { getWrapperDisplayName } from '@wordpress/element';
import { withContext } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getColorValue, getColorClass, setColorValue } from './utils';
import './style.scss';

/**
 * Higher-order component, which handles color logic for class generation
 * color value, retrieval and color attribute setting.
 *
 * @param {WPElement} WrappedComponent The wrapped component.
 *
 * @return {Component} Component with a new colors prop.
 */
export default function withColors( WrappedComponent ) {
	const ComponentWithColorContext = withContext( 'editor' )(
		( settings, props ) => {
			const colors = get( settings, [ 'colors' ], [] );
			return {
				initializeColor: ( { colorContext, colorAttribute, customColorAttribute } ) => ( {
					value: getColorValue(
						colors,
						props.attributes[ colorAttribute ],
						props.attributes[ customColorAttribute ]
					),
					class: getColorClass( colorContext, props.attributes[ colorAttribute ] ),
					set: setColorValue( colors, colorAttribute, customColorAttribute, props.setAttributes ),
				} ),
			};
		} )( WrappedComponent );

	const EnhancedComponent = ( props ) => {
		return <ComponentWithColorContext { ...props } />;
	};
	EnhancedComponent.displayName = getWrapperDisplayName( ComponentWithColorContext, 'colorMechanism' );

	return EnhancedComponent;
}
