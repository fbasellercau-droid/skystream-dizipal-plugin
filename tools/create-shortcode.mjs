const API_KEY = process.env.CUTTLY_API_KEY;
const TARGET_URL = "https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json";
const ALIAS = "sky-egici";

if (!API_KEY) {
  console.error("CUTTLY_API_KEY is required.");
  process.exit(1);
}

const endpoint = new URL("https://cutt.ly/api/api.php");
endpoint.searchParams.set("key", API_KEY);
endpoint.searchParams.set("short", TARGET_URL);
endpoint.searchParams.set("name", ALIAS);

let response;
let text;

try {
  response = await fetch(endpoint);
  text = await response.text();
} catch (error) {
  console.error("Cuttly API could not be reached. Try again from a network where cutt.ly is accessible.");
  console.error(error?.cause?.code || error?.message || String(error));
  process.exit(1);
}
let payload;

try {
  payload = JSON.parse(text);
} catch {
  console.error(text);
  process.exit(1);
}

const result = payload?.url || {};
const status = Number(result.status);

if (status === 7 || status === 1) {
  console.log(result.shortLink || `https://cutt.ly/${ALIAS}`);
  process.exit(0);
}

if (status === 3) {
  console.error(`${ALIAS} is already taken. If it is yours, edit it in Cuttly to point at ${TARGET_URL}.`);
  process.exit(1);
}

console.error(JSON.stringify(payload, null, 2));
process.exit(1);
