import "./_env";
import { importZomatoCatalog } from "../src/lib/server/zomato-catalog";
const apply = process.argv.includes("--apply");
importZomatoCatalog(apply).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }).catch((e) => { console.error(e.message); process.exit(1); });
