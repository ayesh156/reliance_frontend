"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressAndConvertToWebP = compressAndConvertToWebP;
/**
 * Enterprise-grade Client-Side Image Compressor & WebP Converter
 * Converts pasted clipboard blobs/files into optimized WebP images
 * reducing payload size by up to 90% before uploading to the server.
 */
async function compressAndConvertToWebP(fileOrBlob, maxDimension = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                // Maintain aspect ratio while capping the maximum dimension
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                }
                else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context initialization failed'));
                    return;
                }
                // Draw image cleanly on canvas
                ctx.drawImage(img, 0, 0, width, height);
                // Export directly to lightweight Modern WebP
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('WebP compression failed'));
                        return;
                    }
                    const cleanFileName = `pasted-image-${Date.now()}.webp`;
                    const optimizedFile = new File([blob], cleanFileName, {
                        type: 'image/webp',
                    });
                    resolve(optimizedFile);
                }, 'image/webp', quality);
            };
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = event.target?.result;
        };
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(fileOrBlob);
    });
}
//# sourceMappingURL=imageCompressor.js.map