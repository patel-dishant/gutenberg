/**
 * External dependencies
 */
import { parse } from 'url';
import { includes, kebabCase, toLower } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { Component, renderToString } from '@wordpress/element';
import { Button, Placeholder, Spinner, SandBox, IconButton, Toolbar } from '@wordpress/components';
import { createBlock } from '@wordpress/blocks';
import { RichText, BlockControls } from '@wordpress/editor';
import { withSelect } from '@wordpress/data';

// These embeds do not work in sandboxes
const HOSTS_NO_PREVIEWS = [ 'facebook.com' ];

const matchesPatterns = ( url, patterns = [] ) => {
	return patterns.some( ( pattern ) => {
		return url.match( pattern );
	} );
};

const findBlock = ( url ) => {
	for ( const block of [ ...common, ...others ] ) {
		if ( matchesPatterns( url, block.patterns ) ) {
			return block.name;
		}
	}
	return 'core/embed';
};

export function getEmbedEdit( title, icon ) {
	return class extends Component {
		constructor() {
			super( ...arguments );

			this.switchBackToURLInput = this.switchBackToURLInput.bind( this );
			this.setUrl = this.setUrl.bind( this );
			this.maybeSwitchBlock = this.maybeSwitchBlock.bind( this );
			this.setAttributesFromPreview = this.setAttributesFromPreview.bind( this );

			this.state = {
				editingURL: false,
				url: this.props.attributes.url,
			};

			this.maybeSwitchBlock();
		}

		componentWillUnmount() {
			// can't abort the fetch promise, so let it know we will unmount
			this.unmounting = true;
		}

		componentDidUpdate( prevProps ) {
			const hasPreview = undefined !== this.props.preview;
			const hadPreview = undefined !== prevProps.preview;
			// We had a preview, and the URL was edited, and the new URL already has a preview fetched.
			const switchedPreview = this.props.preview && this.props.attributes.url !== prevProps.attributes.url;
			const switchedURL = this.props.attributes.url !== prevProps.attributes.url;

			if ( switchedURL && this.maybeSwitchBlock() ) {
				return;
			}

			if ( ( hasPreview && ! hadPreview ) || switchedPreview ) {
				if ( this.props.previewIsFallback ) {
					this.setState( { editingURL: true } );
					return;
				}
				this.setAttributesFromPreview();
			}
		}

		getPhotoHtml( photo ) {
			// 100% width for the preview so it fits nicely into the document, some "thumbnails" are
			// acually the full size photo.
			const photoPreview = <p><img src={ photo.thumbnail_url } alt={ photo.title } width="100%" /></p>;
			return renderToString( photoPreview );
		}

		setUrl( event ) {
			if ( event ) {
				event.preventDefault();
			}
			const { url } = this.state;
			const { setAttributes } = this.props;
			this.setState( { editingURL: false } );
			setAttributes( { url } );
		}

		/***
		 * Maybe switches to a different embed block type, based on the URL
		 * and the HTML in the preview.
		 *
		 * @return {boolean} Whether the block was switched.
		 */
		maybeSwitchBlock() {
			const { preview } = this.props;
			const { url } = this.props.attributes;

			if ( ! url ) {
				return false;
			}

			const matchingBlock = findBlock( url );

			// WordPress blocks can work on multiple sites, and so don't have patterns,
			// so if we're in a WordPress block, assume the user has chosen it for a WordPress URL.
			if ( 'core-embed/wordpress' !== this.props.name && 'core/embed' !== matchingBlock ) {
				// At this point, we have discovered a more suitable block for this url, so transform it.
				if ( this.props.name !== matchingBlock ) {
					this.props.onReplace( createBlock( matchingBlock, { url } ) );
					return true;
				}
			}

			if ( preview ) {
				const { html } = preview;

				// This indicates it's a WordPress embed, there aren't a set of URL patterns we can use to match WordPress URLs.
				if ( includes( html, 'class="wp-embedded-content" data-secret' ) ) {
					// If this is not the WordPress embed block, transform it into one.
					if ( this.props.name !== 'core-embed/wordpress' ) {
						this.props.onReplace( createBlock( 'core-embed/wordpress', { url } ) );
						return true;
					}
				}
			}

			return false;
		}

		/***
		 * Sets block attributes based on the preview data.
		 */
		setAttributesFromPreview() {
			const { setAttributes, preview } = this.props;

			// Some plugins only return HTML with no type info, so default this to 'rich'.
			let { type = 'rich' } = preview;
			// If we got a provider name from the API, use it for the slug, otherwise we use the title,
			// because not all embed code gives us a provider name.
			const { html, provider_name: providerName } = preview;
			const providerNameSlug = kebabCase( toLower( '' !== providerName ? providerName : title ) );

			if ( includes( html, 'class="wp-embedded-content" data-secret' ) ) {
				type = 'wp-embed';
			}

			if ( html || 'photo' === type ) {
				setAttributes( { type, providerNameSlug } );
			}
		}

		switchBackToURLInput() {
			this.setState( { editingURL: true } );
		}

		render() {
			const { url, editingURL } = this.state;
			const { caption, type } = this.props.attributes;
			const { fetching, setAttributes, isSelected, className, preview, previewIsFallback } = this.props;
			const controls = (
				<BlockControls>
					<Toolbar>
						{ ( preview && ! previewIsFallback && <IconButton
							className="components-toolbar__control"
							label={ __( 'Edit URL' ) }
							icon="edit"
							onClick={ this.switchBackToURLInput }
						/> ) }
					</Toolbar>
				</BlockControls>
			);

			if ( fetching ) {
				return (
					<div className="wp-block-embed is-loading">
						<Spinner />
						<p>{ __( 'Embedding…' ) }</p>
					</div>
				);
			}

			if ( ! preview || previewIsFallback || editingURL ) {
				// translators: %s: type of embed e.g: "YouTube", "Twitter", etc. "Embed" is used when no specific type exists
				const label = sprintf( __( '%s URL' ), title );

				return (
					<Placeholder icon={ icon } label={ label } className="wp-block-embed">
						<form onSubmit={ this.setUrl }>
							<input
								type="url"
								value={ url || '' }
								className="components-placeholder__input"
								aria-label={ label }
								placeholder={ __( 'Enter URL to embed here…' ) }
								onChange={ ( event ) => this.setState( { url: event.target.value } ) } />
							<Button
								isLarge
								type="submit">
								{ __( 'Embed' ) }
							</Button>
							{ previewIsFallback && <p className="components-placeholder__error">{ __( 'Sorry, we could not embed that content.' ) }</p> }
						</form>
					</Placeholder>
				);
			}

			const html = 'photo' === type ? this.getPhotoHtml( preview ) : preview.html;
			const parsedUrl = parse( url );
			const cannotPreview = includes( HOSTS_NO_PREVIEWS, parsedUrl.host.replace( /^www\./, '' ) );
			// translators: %s: host providing embed content e.g: www.youtube.com
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

			return (
				<figure className={ classnames( className, 'wp-block-embed', { 'is-video': 'video' === type } ) }>
					{ controls }
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
							inlineToolbar
						/>
					) : null }
				</figure>
			);
		}
	};
}

function getEmbedBlockSettings( { title, description, icon, category = 'embed', transforms, keywords = [] } ) {
	// translators: %s: Name of service (e.g. VideoPress, YouTube)
	const blockDescription = description || sprintf( __( 'Add a block that displays content pulled from other sites, like Twitter, Instagram or YouTube.' ), title );
	return {
		title,
		description: blockDescription,
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
			type: {
				type: 'string',
			},
			providerNameSlug: {
				type: 'string',
			},
		},

		supports: {
			align: true,
		},

		transforms,

		edit: compose(
			withSelect( ( select, ownProps ) => {
				const { url } = ownProps.attributes;
				const core = select( 'core' );
				const { getEmbedPreview, isPreviewEmbedFallback, isRequestingEmbedPreview } = core;
				const preview = getEmbedPreview( url );
				const previewIsFallback = isPreviewEmbedFallback( url );
				const fetching = undefined !== url && isRequestingEmbedPreview( url );
				return {
					preview,
					previewIsFallback,
					fetching,
				};
			} )
		)( getEmbedEdit( title, icon ) ),

		save( { attributes } ) {
			const { url, caption, type, providerNameSlug } = attributes;

			if ( ! url ) {
				return null;
			}

			const embedClassName = classnames( 'wp-block-embed', {
				[ `is-type-${ type }` ]: type,
				[ `is-provider-${ providerNameSlug }` ]: providerNameSlug,
			} );

			return (
				<figure className={ embedClassName }>
					{ `\n${ url }\n` /* URL needs to be on its own line. */ }
					{ caption && caption.length > 0 && <RichText.Content tagName="figcaption" value={ caption } /> }
				</figure>
			);
		},
	};
}

export const name = 'core/embed';

export const settings = getEmbedBlockSettings( {
	title: __( 'Embed' ),
	description: __( 'The Embed block allows you to easily add videos, images, tweets, audio, and other content to your post or page.' ),
	icon: <svg version="1" width="24" height="24"><path fill="none" d="M0 0h24v24H0V0z"/><path fill="none" d="M0 0h24v24H0V0z"/><g><path d="M21 3H3L1 5v3h2V5h18v14h-7v2h7l2-2V5l-2-2zM1 18v3h3c0-2-1-3-3-3zm0-4v2c3 0 5 2 5 5h2c0-4-3-7-7-7zm0-4v2c5 0 9 4 9 9h2c0-6-5-11-11-11z"/></g></svg>,
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

const embedContentIcon = <svg version="1" width="24" height="24"><path fill="none" d="M0 0h24v24H0V0z"/><path fill="none" d="M0 0h24v24H0V0z"/><g><path d="M21 3H3L1 5v3h2V5h18v14h-7v2h7l2-2V5l-2-2zM1 18v3h3c0-2-1-3-3-3zm0-4v2c3 0 5 2 5 5h2c0-4-3-7-7-7zm0-4v2c5 0 9 4 9 9h2c0-6-5-11-11-11z"/></g></svg>;
const embedAudioIcon = <svg version="1" width="24" height="24"><path fill="none" d="M0 0h24v24H0V0z"/><path d="M21 3H3L1 5v14l2 2h18l2-2V5l-2-2zm0 16H3V5h18v14zM8 15a3 3 0 0 1 4-3V6h5v2h-3v7a3 3 0 0 1-6 0z"/></svg>;

export const common = [
	{
		name: 'core-embed/twitter',
		settings: getEmbedBlockSettings( {
			title: 'Twitter',
			icon: {
				background: '#1DA1F2',
				foreground: '#ffffff',
				src: <svg height="48" width="48" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g><path d="M22.23 5.924c-.736.326-1.527.547-2.357.646.847-.508 1.498-1.312 1.804-2.27-.793.47-1.67.812-2.606.996C18.325 4.498 17.258 4 16.078 4c-2.266 0-4.103 1.837-4.103 4.103 0 .322.036.635.106.935-3.41-.17-6.433-1.804-8.457-4.287-.353.607-.556 1.312-.556 2.064 0 1.424.724 2.68 1.825 3.415-.673-.022-1.305-.207-1.86-.514v.052c0 1.988 1.415 3.647 3.293 4.023-.344.095-.707.145-1.08.145-.265 0-.522-.026-.773-.074.522 1.63 2.038 2.817 3.833 2.85-1.404 1.1-3.174 1.757-5.096 1.757-.332 0-.66-.02-.98-.057 1.816 1.164 3.973 1.843 6.29 1.843 7.547 0 11.675-6.252 11.675-11.675 0-.178-.004-.355-.012-.53.802-.578 1.497-1.3 2.047-2.124z"></path></g></svg>,
			},
			keywords: [ __( 'tweet' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?twitter\.com\/.+/i ],
	},
	{
		name: 'core-embed/youtube',
		settings: getEmbedBlockSettings( {
			title: 'YouTube',
			icon: {
				background: '#ffffff',
				foreground: '#ff0000',
				src: <svg height="48" width="48" viewBox="0 0 24 24"><path d="M22 8l-1-2-2-1H5L3 6 2 8v8l1 2 2 1h14l2-1 1-2v-5-3zm-12 7V9l5 3-5 3z"/></svg>,
			},
			keywords: [ __( 'music' ), __( 'video' ) ],
		} ),
		patterns: [ /^https?:\/\/((m|www)\.)?youtube\.com\/.+/i, /^https?:\/\/youtu\.be\/.+/i ],
	},
	{
		name: 'core-embed/facebook',
		settings: getEmbedBlockSettings( {
			title: 'Facebook',
			icon: {
				background: '#3B5998',
				foreground: '#ffffff',
				src: <svg class="social-logo facebook" height="48" width="48" viewBox="0 0 24 24"><path d="M20 3H4L3 4v16l1 1h9v-7h-3v-3h3V9c0-2 1-3 3-3h2v2h-1l-2 2v1h3v3h-3v7h5l1-1V4l-1-1z"/></svg>,
			},
		} ),
		patterns: [ /^https?:\/\/www\.facebook.com\/.+/i ],
	},
	{
		name: 'core-embed/instagram',
		settings: getEmbedBlockSettings( {
			title: 'Instagram',
			icon: {
				background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)',
				foreground: '#ffffff',
				src: <svg class="social-logo instagram" height="48" width="48" viewBox="0 0 24 24"><path d="M12 5a64 64 0 0 1 5 0l1 1 1 1v1a63 63 0 0 1 0 9l-1 1-1 1h-1a63 63 0 0 1-9 0l-1-1-1-1v-1a63 63 0 0 1 0-9l1-1 1-1h5m0-2a64 64 0 0 0-6 0L5 5 3 6v2a64 64 0 0 0 0 10l2 1 1 2h2a64 64 0 0 0 10 0l1-2 2-1v-2a64 64 0 0 0 0-10l-2-1-1-2h-6zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-9a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>,
			},
			keywords: [ __( 'image' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?instagr(\.am|am\.com)\/.+/i ],
	},
	{
		name: 'core-embed/wordpress',
		settings: getEmbedBlockSettings( {
			title: 'WordPress',
			icon: 'embed-post',
			keywords: [ __( 'post' ), __( 'blog' ) ],
		} ),
	},
	{
		name: 'core-embed/soundcloud',
		settings: getEmbedBlockSettings( {
			title: 'SoundCloud',
			icon: embedAudioIcon,
			keywords: [ __( 'music' ), __( 'audio' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?soundcloud\.com\/.+/i ],
	},
	{
		name: 'core-embed/spotify',
		settings: getEmbedBlockSettings( {
			title: 'Spotify',
			icon: {
				background: '#1DB954',
				foreground: '#ffffff',
				src: <svg height="48" width="48" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m5 14l-1 1c-3-2-6-2-9-1a1 1 0 1 1 0-2c3 0 7 0 9 2h1m1-2h-1c-3-2-7-2-10-1a1 1 0 1 1-1-2c4-1 8 0 12 2v1m0-3c-3-2-9-2-12-1a1 1 0 0 1 0-2c3-1 9-1 13 1a1 1 0 1 1-1 2"/></svg>,
			},
			keywords: [ __( 'music' ), __( 'audio' ) ],
		} ),
		patterns: [ /^https?:\/\/(open|play)\.spotify\.com\/.+/i ],
	},
	{
		name: 'core-embed/flickr',
		settings: getEmbedBlockSettings( {
			title: 'Flickr',
			icon: 'embed-photo',
			keywords: [ __( 'image' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?flickr\.com\/.+/i, /^https?:\/\/flic\.kr\/.+/i ],
	},
	{
		name: 'core-embed/vimeo',
		settings: getEmbedBlockSettings( {
			title: 'Vimeo',
			icon: 'embed-video',
			keywords: [ __( 'video' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?vimeo\.com\/.+/i ],
	},
];

export const others = [
	{
		name: 'core-embed/animoto',
		settings: getEmbedBlockSettings( {
			title: 'Animoto',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?(animoto|video214)\.com\/.+/i ],
	},
	{
		name: 'core-embed/cloudup',
		settings: getEmbedBlockSettings( {
			title: 'Cloudup',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/cloudup\.com\/.+/i ],
	},
	{
		name: 'core-embed/collegehumor',
		settings: getEmbedBlockSettings( {
			title: 'CollegeHumor',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?collegehumor\.com\/.+/i ],
	},
	{
		name: 'core-embed/dailymotion',
		settings: getEmbedBlockSettings( {
			title: 'Dailymotion',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?dailymotion\.com\/.+/i ],
	},
	{
		name: 'core-embed/funnyordie',
		settings: getEmbedBlockSettings( {
			title: 'Funny or Die',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?funnyordie\.com\/.+/i ],
	},
	{
		name: 'core-embed/hulu',
		settings: getEmbedBlockSettings( {
			title: 'Hulu',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?hulu\.com\/.+/i ],
	},
	{
		name: 'core-embed/imgur',
		settings: getEmbedBlockSettings( {
			title: 'Imgur',
			icon: 'embed-photo',
		} ),
		patterns: [ /^https?:\/\/(.+\.)?imgur\.com\/.+/i ],
	},
	{
		name: 'core-embed/issuu',
		settings: getEmbedBlockSettings( {
			title: 'Issuu',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?issuu\.com\/.+/i ],
	},
	{
		name: 'core-embed/kickstarter',
		settings: getEmbedBlockSettings( {
			title: 'Kickstarter',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?kickstarter\.com\/.+/i, /^https?:\/\/kck\.st\/.+/i ],
	},
	{
		name: 'core-embed/meetup-com',
		settings: getEmbedBlockSettings( {
			title: 'Meetup.com',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?meetu(\.ps|p\.com)\/.+/i ],
	},
	{
		name: 'core-embed/mixcloud',
		settings: getEmbedBlockSettings( {
			title: 'Mixcloud',
			icon: embedAudioIcon,
			keywords: [ __( 'music' ), __( 'audio' ) ],
		} ),
		patterns: [ /^https?:\/\/(www\.)?mixcloud\.com\/.+/i ],
	},
	{
		name: 'core-embed/photobucket',
		settings: getEmbedBlockSettings( {
			title: 'Photobucket',
			icon: 'embed-photo',
		} ),
		patterns: [ /^http:\/\/g?i*\.photobucket\.com\/.+/i ],
	},
	{
		name: 'core-embed/polldaddy',
		settings: getEmbedBlockSettings( {
			title: 'Polldaddy',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?mixcloud\.com\/.+/i ],
	},
	{
		name: 'core-embed/reddit',
		settings: getEmbedBlockSettings( {
			title: 'Reddit',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?reddit\.com\/.+/i ],
	},
	{
		name: 'core-embed/reverbnation',
		settings: getEmbedBlockSettings( {
			title: 'ReverbNation',
			icon: embedAudioIcon,
		} ),
		patterns: [ /^https?:\/\/(www\.)?reverbnation\.com\/.+/i ],
	},
	{
		name: 'core-embed/screencast',
		settings: getEmbedBlockSettings( {
			title: 'Screencast',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.)?screencast\.com\/.+/i ],
	},
	{
		name: 'core-embed/scribd',
		settings: getEmbedBlockSettings( {
			title: 'Scribd',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?scribd\.com\/.+/i ],
	},
	{
		name: 'core-embed/slideshare',
		settings: getEmbedBlockSettings( {
			title: 'Slideshare',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(.+?\.)?slideshare\.net\/.+/i ],
	},
	{
		name: 'core-embed/smugmug',
		settings: getEmbedBlockSettings( {
			title: 'SmugMug',
			icon: 'embed-photo',
		} ),
		patterns: [ /^https?:\/\/(www\.)?smugmug\.com\/.+/i ],
	},
	{
		name: 'core-embed/speaker',
		settings: getEmbedBlockSettings( {
			title: 'Speaker',
			icon: embedAudioIcon,
		} ),
		patterns: [ /^https?:\/\/(www\.)?speakerdeck\.com\/.+/i ],
	},
	{
		name: 'core-embed/ted',
		settings: getEmbedBlockSettings( {
			title: 'TED',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/(www\.|embed\.)?ted\.com\/.+/i ],
	},
	{
		name: 'core-embed/tumblr',
		settings: getEmbedBlockSettings( {
			title: 'Tumblr',
			icon: 'embed-post',
		} ),
		patterns: [ /^https?:\/\/(www\.)?tumblr\.com\/.+/i ],
	},
	{
		name: 'core-embed/videopress',
		settings: getEmbedBlockSettings( {
			title: 'VideoPress',
			icon: 'embed-video',
			keywords: [ __( 'video' ) ],
		} ),
		patterns: [ /^https?:\/\/videopress\.com\/.+/i ],
	},
	{
		name: 'core-embed/wordpress-tv',
		settings: getEmbedBlockSettings( {
			title: 'WordPress.tv',
			icon: 'embed-video',
		} ),
		patterns: [ /^https?:\/\/wordpress\.tv\/.+/i ],
	},
];