// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - S3-Compatible Storage (MinIO) Configuration
// ═══════════════════════════════════════════════════════════════════════════════

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// L1 FIX: No silent fallback to dev credentials
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;

if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.warn('[storage] S3_ACCESS_KEY or S3_SECRET_KEY not set. File uploads will fail.');
}

const s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
        accessKeyId: S3_ACCESS_KEY || '',
        secretAccessKey: S3_SECRET_KEY || '',
    },
    forcePathStyle: process.env.S3_USE_PATH_STYLE === 'true',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'wija-media';

// M3 FIX: Sanitize S3 key to prevent path traversal
function sanitizeKey(key: string): string {
    return key.replace(/\.\.\/|\.\.\\/g, '').replace(/[^a-zA-Z0-9\-_\/\.]/g, '_');
}

/**
 * Upload a file to S3/MinIO
 */
export async function uploadFile(
    key: string,
    body: Buffer | Uint8Array | ReadableStream,
    contentType: string
): Promise<string> {
    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );
    return key;
}

/**
 * Get a pre-signed URL for downloading a file
 */
export async function getFileUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a pre-signed URL for uploading a file
 */
export async function getUploadUrl(key: string, contentType: string, expiresIn = 600): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a file from S3/MinIO
 */
export async function deleteFile(key: string): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        })
    );
}

/**
 * Generate a storage key for person photos
 */
export function getPersonPhotoKey(treeId: string, personId: string, filename: string): string {
    const ext = filename.split('.').pop() || 'jpg';
    return `trees/${treeId}/persons/${personId}/photo.${ext}`;
}

/**
 * Generate a storage key for thumbnails
 */
export function getPersonThumbnailKey(treeId: string, personId: string): string {
    return `trees/${treeId}/persons/${personId}/thumbnail.jpg`;
}

/**
 * Generate a storage key for GEDCOM exports
 */
export function getGedcomExportKey(treeId: string): string {
    const timestamp = Date.now();
    return `trees/${treeId}/exports/gedcom-${timestamp}.ged`;
}

export { s3Client, BUCKET_NAME };
