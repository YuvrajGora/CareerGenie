import { v2 as cloudinary } from 'cloudinary';

function getCloudinaryConfigured(): boolean {
  const isConfigured = 
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET;

  if (isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return true;
  }
  return false;
}

/**
 * Uploads a file (base64 string) to Cloudinary.
 * If Cloudinary is not configured, returns a realistic mock placeholder URL.
 */
export async function uploadToCloudinary(
  fileData: string, // Base64 encoded file string
  folder: 'resumes' | 'profiles'
): Promise<string> {
  const configured = getCloudinaryConfigured();
  if (!configured) {
    console.info(`Cloudinary upload skipped (mock mode). Folder target: ${folder}`);
    const randomId = Math.floor(Math.random() * 1000000);
    if (folder === 'profiles') {
      // Returns a nice custom SVG avatar URL from Dicebear
      return `https://api.dicebear.com/7.x/initials/svg?seed=user_${randomId}`;
    }
    // Returns a stable, standard test PDF URL
    return `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`;
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      fileData,
      {
        folder: `careergenie/${folder}`,
        resource_type: folder === 'resumes' ? 'raw' : 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          resolve(result?.secure_url || '');
        }
      }
    );
  });
}
