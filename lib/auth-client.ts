import { createAuthClient } from "better-auth/client";
import {
	organizationClient,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [
		twoFactorClient(),
		usernameClient(),
		organizationClient({
			teams: {
				enabled: true,
			},
		}),
	],
});
