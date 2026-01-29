"use client";

import { LayoutTemplate, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { useSession } from "@/components/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export function AppHeader() {
	const { data: session } = useSession();
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login"); // ログインページへリダイレクト
				},
			},
		});
	};

	const userInitials = useMemo(() => {
		if (!session?.user?.name) return "U";
		return session.user.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}, [session?.user?.name]);

	return (
		<header className="flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60 z-30">
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
					<LayoutTemplate className="h-5 w-5" />
				</div>
				<div>
					<h1 className="text-lg font-bold leading-tight tracking-tight">
						SlideGen Real Estate
					</h1>
					<p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
						Automated Presentation Builder
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<ModeToggle />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="relative h-8 w-8 rounded-full">
							<Avatar className="h-8 w-8">
								<AvatarImage
									src={session.user.image || ""}
									alt={session.user.name}
								/>
								<AvatarFallback>{userInitials}</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="end" forceMount>
						<DropdownMenuLabel className="font-normal">
							<div className="flex flex-col space-y-1">
								<p className="text-sm font-medium leading-none">
									{session.user.name}
								</p>
								<p className="text-xs leading-none text-muted-foreground">
									{session.user.email}
								</p>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<User className="mr-2 h-4 w-4" />
								<span>プロフィール</span>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Settings className="mr-2 h-4 w-4" />
								<span>設定</span>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut}>
							<LogOut className="mr-2 h-4 w-4" />
							<span>ログアウト</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
