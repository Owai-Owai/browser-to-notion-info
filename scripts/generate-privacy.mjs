import { mkdirSync,writeFileSync } from "node:fs";
import { privacyPage } from "../shared/privacy-page.ts";

const publisherName=process.env.PUBLISHER_NAME?.trim(),supportEmail=process.env.SUPPORT_EMAIL?.trim();
if (!publisherName || !supportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) || /YOUR_|CHANGE_ME/i.test(`${publisherName} ${supportEmail}`)) throw new Error("Set the real PUBLISHER_NAME and SUPPORT_EMAIL in .env.supabase.local before generating the public policy.");
mkdirSync("public-site",{ recursive: true });
writeFileSync("public-site/privacy.html",privacyPage({ publisherName,supportEmail,provider: "Supabase" }));
writeFileSync("public-site/index.html",'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser to Notion</title><main><h1>Browser to Notion</h1><p>Save your selected Chrome bookmarks to your Notion collection.</p><a href="privacy.html">Privacy policy and support</a></main></html>');
console.info("Generated public-site/privacy.html and index.html. Review the policy and publish these files on a static host.");
