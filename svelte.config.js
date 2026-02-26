import adapter from '@sveltejs/adapter-static';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const basePath = process.env.BASE_PATH ?? (repository ? `/${repository}` : '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html'
		}),
		paths: {
			base: basePath
		}
	}
};

export default config;
