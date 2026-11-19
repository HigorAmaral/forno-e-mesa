import { execSync } from "node:child_process";

function run(cmd, env = process.env) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
}

run("npx prisma generate");

const pushUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (pushUrl) {
  console.log("Database URL detected — syncing schema with prisma db push...");
  try {
    run("npx prisma db push --skip-generate", {
      ...process.env,
      DATABASE_URL: pushUrl,
    });
  } catch (err) {
    console.warn(
      "⚠️  prisma db push failed during build (continuing with next build). " +
        "Ensure DIRECT_URL/DATABASE_URL allows schema push or run `npx prisma db push` manually.",
    );
    if (err instanceof Error) console.warn(err.message);
  }
} else {
  console.log("DATABASE_URL not set yet — skipping prisma db push during build.");
}

run("npx next build");
