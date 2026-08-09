import { parseBalePhoneText, isNonRegistryOrigin } from "@/lib/parser/bale-phone-parser";
import type {
  Order,
  OrderItem,
  Product,
  ProductImport,
  Profile,
} from "@/types/database";
import { CHANNEL_SEED_TEXT } from "@/lib/demo/channel-seed";
import { CHANNEL_SEED_IPHONE_NOREG_TEXT } from "@/lib/demo/iphone-noreg-seed";
import { parseChannelDateToIso } from "@/lib/utils/date";

const channelUpdatedAt =
  parseChannelDateToIso(CHANNEL_SEED_TEXT, 14, 30) ??
  new Date().toISOString();
const noregUpdatedAt =
  parseChannelDateToIso(CHANNEL_SEED_IPHONE_NOREG_TEXT, 15, 10) ??
  channelUpdatedAt;

const now = channelUpdatedAt;

export const DEMO_ADMIN: Profile = {
  id: "demo-admin-id",
  full_name: "ادمین دمو",
  phone: "09121234567",
  role: "admin",
  created_at: now,
  updated_at: now,
};

export const DEMO_CAT_MOBILE = "demo-cat-mobile";
export const DEMO_CAT_IPHONE_NOREG = "demo-cat-iphone-noreg";

function mapParsed(
  products: ReturnType<typeof parseBalePhoneText>["products"],
  idPrefix: string,
  startIdx: number,
  categoryId: string,
  stampedAt: string
): Product[] {
  return products.map((p, idx) => ({
    id: `${idPrefix}-${startIdx + idx + 1}`,
    category_id: categoryId,
    brand: p.brand,
    model: p.model,
    storage: p.storage,
    ram: p.ram,
    color: p.color,
    price: p.price,
    stock: 0,
    origin: p.origin,
    description: isNonRegistryOrigin(p.origin)
      ? "آیفون بدون کد ریجستری"
      : null,
    image_url: null,
    is_active: true,
    raw_import_text: p.raw_line,
    created_at: stampedAt,
    updated_at: stampedAt,
  }));
}

function buildSeedProducts(): Product[] {
  const mobile = parseBalePhoneText(CHANNEL_SEED_TEXT);
  const noreg = parseBalePhoneText(CHANNEL_SEED_IPHONE_NOREG_TEXT);
  return [
    ...mapParsed(mobile.products, "demo-seed", 0, DEMO_CAT_MOBILE, channelUpdatedAt),
    ...mapParsed(
      noreg.products,
      "demo-noreg",
      0,
      DEMO_CAT_IPHONE_NOREG,
      noregUpdatedAt
    ),
  ];
}

export const DEMO_PRODUCTS: Product[] = buildSeedProducts();

export const DEMO_ORDERS: Order[] = [
  {
    id: "demo-order-1",
    user_id: "demo-user-1",
    status: "pending_confirmation",
    total_amount: DEMO_PRODUCTS[0]?.price ?? 41716980,
    shipping_address: "تهران، خیابان ولیعصر، پلاک ۱۲۳",
    contact_phone: "09121234567",
    notes: null,
    confirmed_amount: null,
    shipping_amount: null,
    payment_ref: null,
    tracking_number: null,
    invoice_sent_at: null,
    payment_confirmed_at: null,
    shipped_at: null,
    payment_deadline_at: null,
    admin_confirm_deadline_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "demo-order-2",
    user_id: "demo-user-1",
    status: "awaiting_payment",
    total_amount: DEMO_PRODUCTS.find((p) => p.brand === "Xiaomi")?.price ?? 107089800,
    shipping_address: "اصفهان، خیابان چهارباغ",
    contact_phone: "09129876543",
    notes: "موجودی تأیید شد",
    confirmed_amount:
      DEMO_PRODUCTS.find((p) => p.brand === "Xiaomi")?.price ?? 107089800,
    shipping_amount: 150000,
    payment_ref: null,
    tracking_number: null,
    invoice_sent_at: now,
    payment_confirmed_at: null,
    shipped_at: null,
    payment_deadline_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    admin_confirm_deadline_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: now,
    updated_at: now,
  },
];

export const DEMO_ORDER_ITEMS: OrderItem[] = [
  {
    id: "demo-oi-1",
    order_id: "demo-order-1",
    product_id: DEMO_PRODUCTS[0]?.id ?? "demo-seed-1",
    quantity: 1,
    unit_price: DEMO_PRODUCTS[0]?.price ?? 0,
    color: DEMO_PRODUCTS[0]?.color ?? null,
    product_title: DEMO_PRODUCTS[0]
      ? `${DEMO_PRODUCTS[0].brand} ${DEMO_PRODUCTS[0].model}`
      : "محصول",
    created_at: now,
  },
];

export const DEMO_USERS: Profile[] = [
  DEMO_ADMIN,
  {
    id: "demo-user-1",
    full_name: "کاربر نمونه",
    phone: "09121111111",
    role: "user",
    created_at: now,
    updated_at: now,
  },
];

export const DEMO_IMPORTS: ProductImport[] = [
  {
    id: "demo-import-1",
    raw_text: CHANNEL_SEED_TEXT,
    parsed_count: DEMO_PRODUCTS.length,
    imported_by: DEMO_ADMIN.id,
    created_at: now,
  },
];

export const DEMO_SAMPLE_IMPORT_TEXT = CHANNEL_SEED_TEXT;
