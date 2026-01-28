import {
	adminClient,
	organizationClient,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

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
