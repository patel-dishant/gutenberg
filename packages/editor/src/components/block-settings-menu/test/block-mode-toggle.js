/**
 * External dependencies
 */
import { shallow } from 'enzyme';

/**
 * Internal dependencies
 */
import { BlockModeToggle } from '../block-mode-toggle';

describe( 'BlockModeToggle', () => {
	it( "should not render the HTML mode button if the block doesn't support it", () => {
		const wrapper = shallow(
			<BlockModeToggle blockType={ { supports: { html: false } } } />
		);

		expect( wrapper.equals( null ) ).toBe( true );
	} );

	it( 'should render the HTML mode button', () => {
		const wrapper = shallow(
			<BlockModeToggle
				blockType={ { supports: { html: true } } }
				mode="visual"
			/>
		);
		const button = wrapper.find( 'MenuItem' ).first();

		expect( button.prop( 'children' ) ).toEqual( 'Edit as HTML' );
		expect( button.prop( 'disabled' ) ).toBe( false );
	} );

	it( 'should render the Visual mode button', () => {
		const wrapper = shallow(
			<BlockModeToggle
				blockType={ { supports: { html: true } } }
				mode="html"
			/>
		);
		const button = wrapper.find( 'MenuItem' ).first();

		expect( button.prop( 'children' ) ).toEqual( 'Edit visually' );
		expect( button.prop( 'disabled' ) ).toBe( false );
	} );

	it( 'should render a disabled button', () => {
		const wrapper = shallow(
			<BlockModeToggle
				blockType={ { supports: { html: true } } }
				mode="html"
				enabled={ false }
			/>
		);
		const button = wrapper.find( 'MenuItem' ).first();

		expect( button.prop( 'disabled' ) ).toBe( true );
	} );
} );
