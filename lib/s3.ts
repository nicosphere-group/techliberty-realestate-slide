// lib/s3.ts

import { S3Client } from "@aws-sdk/client-s3";

const ENDPOINT =
	"https://rdicyprpgreghjslbdts.storage.supabase.co/storage/v1/s3";
const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
	throw new Error("Missing AWS S3 configuration in environment variables.");
}

const globalForS3 = globalThis as unknown as { s3: S3Client };

export const s3 =
	globalForS3.s3 ||
	new S3Client({
		region: AWS_REGION,
		endpoint: ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: AWS_ACCESS_KEY_ID,
			secretAccessKey: AWS_SECRET_ACCESS_KEY,
		},
	});

if (process.env.NODE_ENV !== "production") globalForS3.s3 = s3;
