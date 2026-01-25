import { PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { s3 } from "@/lib/s3";

const BUCKET_NAME = "assets";
const SUPABASE_STORAGE_PUBLIC_URL =
	"https://rdicyprpgreghjslbdts.supabase.co/storage/v1/object/public";

/**
 * S3にアップロードして公開URLを返す
 * @param blob アップロードするBlobデータ
 * @param folder アップロード先のフォルダ名
 * @returns 公開URL
 */
export async function uploadToS3(blob: Blob, folder: string): Promise<string> {
	const timestamp = Date.now();
	const extension = mime.extension(blob.type);
	const key = `${folder}/${folder.replace(/-/g, "_")}-${timestamp}.${extension}`;

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: key,
			Body: Buffer.from(await blob.arrayBuffer()),
			ContentType: blob.type,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	return `${SUPABASE_STORAGE_PUBLIC_URL}/${BUCKET_NAME}/${key}`;
}
