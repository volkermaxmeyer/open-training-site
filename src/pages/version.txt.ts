export const GET = () => new Response(process.env.VERCEL_GIT_COMMIT_SHA ?? "local");
