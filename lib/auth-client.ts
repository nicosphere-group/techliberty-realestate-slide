import { createAuthClient } from "better-auth/client";
import {
	adminClient,
	organizationClient,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [
		twoFactorClient(),
		usernameClient(),
		adminClient(),
		organizationClient({
			teams: {
				enabled: true,
			},
		}),
	],
});
