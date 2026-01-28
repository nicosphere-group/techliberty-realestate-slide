"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

async function checkAdmin() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || !(session.user.role?.split(",") ?? []).includes("admin")) {
		throw new Error("Unauthorized");
	}
	return session;
}

export async function createTeam(organizationId: string, name: string) {
	await checkAdmin();

	const team = await auth.api.createTeam({
		headers: await headers(),
		body: {
			organizationId,
			name,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true, team };
}

export async function inviteMember(
	organizationId: string,
	email: string,
	role: "admin" | "member" | "owner",
) {
	await checkAdmin();

	await auth.api.createInvitation({
		headers: await headers(),
		body: {
			organizationId,
			email,
			role,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true };
}

export async function removeMember(organizationId: string, memberId: string) {
	await checkAdmin();

	await auth.api.removeMember({
		headers: await headers(),
		body: {
			organizationId,
			memberIdOrEmail: memberId,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true };
}

export async function cancelInvitation(invitationId: string) {
	await checkAdmin();

	await auth.api.cancelInvitation({
		headers: await headers(),
		body: {
			invitationId,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true };
}

export async function updateOrganization(
	organizationId: string,
	data: { name: string; slug: string },
) {
	await checkAdmin();

	const org = await auth.api.updateOrganization({
		headers: await headers(),
		body: {
			organizationId,
			data,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true, organization: org };
}

export async function updateTeam(teamId: string, name: string) {
	await checkAdmin();

	const team = await auth.api.updateTeam({
		headers: await headers(),
		body: {
			teamId,
			data: {
				name,
			},
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true, team };
}

export async function removeTeam(teamId: string) {
	await checkAdmin();

	await auth.api.removeTeam({
		headers: await headers(),
		body: {
			teamId,
		},
	});

	revalidatePath("/admin/organizations");
	return { success: true };
}
