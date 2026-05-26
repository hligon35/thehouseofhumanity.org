import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
	{
		ignores: [".open-next/**", "cloudflare-env.d.ts", ".next/**", "node_modules/**"]
	},
	...nextCoreWebVitals
];

export default config;