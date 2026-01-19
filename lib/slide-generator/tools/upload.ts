/**
 * S3アップロード共通関数
 * Supabase Storageを使用
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SUPABASE_STORAGE_ENDPOINT =
	"https://rdicyprpgreghjslbdts.storage.supabase.co/storage/v1/s3";
const SUPABASE_STORAGE_PUBLIC_URL =
	"https://rdicyprpgreghjslbdts.supabase.co/storage/v1/object/public/assets";
const BUCKET_NAME = "assets";

// S3クライアントのシングルトンインスタンス
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!s3Client) {
		s3Client = new S3Client({
			endpoint: SUPABASE_STORAGE_ENDPOINT,
			region: process.env.AWS_REGION || "ap-northeast-1",
			forcePathStyle: true,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
			},
		});
	}
	return s3Client;
}

/**
 * S3にアップロードして公開URLを返す
 * @param data アップロードするデータ（Buffer）
 * @param folder アップロード先のフォルダ名
 * @param contentType Content-Type（デフォルト: image/png）
 * @returns 公開URL
 */
export async function uploadToS3(
	data: Buffer,
	folder: string,
	contentType = "image/png",
): Promise<string> {
	const client = getS3Client();
	const timestamp = Date.now();
	const extension = contentType.split("/")[1] || "png";
	const fileName = `${folder}/${folder.replace(/-/g, "_")}-${timestamp}.${extension}`;

	await client.send(
		new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: fileName,
			Body: data,
			ContentType: contentType,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	return `${SUPABASE_STORAGE_PUBLIC_URL}/${fileName}`;
}

/**
 * MIMEタイプから拡張子を取得
 */
export function getExtensionFromMimeType(mimeType: string): string {
	const mapping: Record<string, string> = {
		"image/png": "png",
		"image/jpeg": "jpg",
		"image/jpg": "jpg",
		"image/webp": "webp",
		"image/gif": "gif",
	};
	return mapping[mimeType] || "png";
}
