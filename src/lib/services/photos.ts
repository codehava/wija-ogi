// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Photo Upload Service
// Handles photo upload to Firebase Storage with compression
// ═══════════════════════════════════════════════════════════════════════════════

import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Max file size after compression (500KB)
const MAX_FILE_SIZE = 500 * 1024;
// Max dimensions for photos
const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
// JPEG quality (0-1)
const JPEG_QUALITY = 0.8;

/**
 * Compress and resize image before upload
 */
async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                },
                'image/jpeg',
                JPEG_QUALITY
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Upload person photo to Firebase Storage
 * @param familyId - Family ID
 * @param personId - Person ID
 * @param file - Image file to upload
 * @returns Download URL of uploaded photo
 */
export async function uploadPersonPhoto(
    familyId: string,
    personId: string,
    file: File
): Promise<string> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar');
    }

    // Validate original file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('Ukuran foto maksimal 10MB');
    }

    // Compress the image
    const compressedBlob = await compressImage(file);

    // Check compressed size
    if (compressedBlob.size > MAX_FILE_SIZE) {
        console.warn(`Compressed size: ${(compressedBlob.size / 1024).toFixed(0)}KB (target: ${MAX_FILE_SIZE / 1024}KB)`);
    }

    // Create storage reference
    const photoRef = ref(storage, `families/${familyId}/persons/${personId}/photo.jpg`);

    // Upload compressed image
    await uploadBytes(photoRef, compressedBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString()
        }
    });

    // Get download URL
    const downloadURL = await getDownloadURL(photoRef);
    return downloadURL;
}

/**
 * Delete person photo from Firebase Storage
 */
export async function deletePersonPhoto(
    familyId: string,
    personId: string
): Promise<void> {
    const photoRef = ref(storage, `families/${familyId}/persons/${personId}/photo.jpg`);
    try {
        await deleteObject(photoRef);
    } catch (error: any) {
        // Ignore if file doesn't exist
        if (error.code !== 'storage/object-not-found') {
            throw error;
        }
    }
}

/**
 * Validate and preview image before upload
 * Returns base64 data URL for preview
 */
export async function previewImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('File harus berupa gambar'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
    });
}
