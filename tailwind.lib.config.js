/** Utility-only build for the published package: scan the lib's own components, emit ONLY
 *  the utilities they use, and disable preflight so we don't reset the consumer's styles. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
