import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL detected — syncing schema with prisma db push...");
  run("npx prisma db push --skip-generate");
} else {
  console.log("DATABASE_URL not set yet — skipping prisma db push during build.");
}

run("npx next build");
