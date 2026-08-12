import { syncDobitkalaLaptops } from "../src/lib/products/laptop-sync";

async function main() {
  const maxNewImages = Number(process.argv[2] || "80");
  const stats = await syncDobitkalaLaptops({
    maxNewImages,
    imageConcurrency: 10,
    deactivateMissing: true,
  });
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
