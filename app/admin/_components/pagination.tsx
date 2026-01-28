"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationProps {
	total: number;
	page: number;
	perPage?: number;
}

export function CustomPagination({
	total,
	page,
	perPage = 20,
}: PaginationProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const totalPages = Math.ceil(total / perPage);

	const createPageURL = (pageNumber: number | string) => {
		const params = new URLSearchParams(searchParams);
		params.set("page", pageNumber.toString());
		return `${pathname}?${params.toString()}`;
	};

	if (totalPages <= 1) return null;

	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href={createPageURL(page - 1)}
						aria-disabled={page <= 1}
						className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
					/>
				</PaginationItem>

				{/* First page */}
				{page > 2 && (
					<PaginationItem>
						<PaginationLink href={createPageURL(1)}>1</PaginationLink>
					</PaginationItem>
				)}
				{page > 3 && (
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
				)}

				{/* Pages around current */}
				{page > 1 && (
					<PaginationItem>
						<PaginationLink href={createPageURL(page - 1)}>
							{page - 1}
						</PaginationLink>
					</PaginationItem>
				)}
				<PaginationItem>
					<PaginationLink href={createPageURL(page)} isActive>
						{page}
					</PaginationLink>
				</PaginationItem>
				{page < totalPages && (
					<PaginationItem>
						<PaginationLink href={createPageURL(page + 1)}>
							{page + 1}
						</PaginationLink>
					</PaginationItem>
				)}

				{/* Last page */}
				{page < totalPages - 2 && (
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
				)}
				{page < totalPages - 1 && (
					<PaginationItem>
						<PaginationLink href={createPageURL(totalPages)}>
							{totalPages}
						</PaginationLink>
					</PaginationItem>
				)}

				<PaginationItem>
					<PaginationNext
						href={createPageURL(page + 1)}
						aria-disabled={page >= totalPages}
						className={
							page >= totalPages ? "pointer-events-none opacity-50" : undefined
						}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
