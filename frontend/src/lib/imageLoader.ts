export default function cloudflareImageLoader({ src }: { src: string }) {
  // Return the original URL without any optimization
  return src;
}
