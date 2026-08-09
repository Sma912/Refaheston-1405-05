export type StoreSettings = {
  id: 1;
  contact_phone: string;
  order_tracking_phone: string;
  payment_sheba: string;
  payment_card_number: string;
  payment_card_holder: string;
  bale_admin_phone: string;
  bale_products_channel_url: string;
  /** لینک ربات بله راهنمای وام بانک رسالت */
  bale_loan_bot_url: string;
  enamad_code: string;
  enamad_url: string;
  ecommerce_license_number: string;
  ecommerce_license_url: string;
  store_address: string;
  /** هزینه ارسال پیش‌فرض به تومان */
  shipping_cost: number;
  footer_tagline: string;
  about_content: string;
  terms_content: string;
  updated_at: string | null;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: 1,
  contact_phone: "",
  order_tracking_phone: "",
  payment_sheba: "",
  payment_card_number: "",
  payment_card_holder: "",
  bale_admin_phone: "",
  bale_products_channel_url: "",
  bale_loan_bot_url: "",
  enamad_code: "",
  enamad_url: "",
  ecommerce_license_number: "",
  ecommerce_license_url: "",
  store_address: "",
  shipping_cost: 0,
  footer_tagline:
    "فروشگاه اینترنتی رفاهستون — تخصصی موبایل و لوازم الکترونیکی. پرداخت پس از تأیید موجودی از طریق اپلیکیشن بله انجام می‌شود.",
  about_content: `رفاهستون از سال‌ها فعالیت در بازار موبایل و لوازم الکترونیکی شکل گرفت؛ ابتدا به‌صورت فروش حضوری و سپس با حضور فعال در پیام‌رسان بله، جایی که لیست روز محصولات و قیمت‌ها برای مشتریان منتشر می‌شود.

هدف ما ساده است: دسترسی شفاف به قیمت روز، تأیید موجودی پیش از پرداخت، و پیگیری سفارش تا لحظه تحویل. به همین دلیل فرایند خرید در سایت با بررسی دستی موجودی و قیمت آغاز می‌شود و مراحل پرداخت و اطلاع‌رسانی از طریق بله ادامه پیدا می‌کند.

امروز رفاهستون ترکیبی از فروشگاه اینترنتی و کانال تخصصی محصولات است تا خریدار هم از راحتی سفارش آنلاین بهره ببرد و هم از سرعت و شفافیت ارتباط در بله.`,
  terms_content: `شرایط اختصاصی خرید از فروشگاه اینترنتی رفاهستون

۱. ثبت سفارش در سایت به‌منزله درخواست بررسی موجودی و قیمت است و تا پیش از تأیید ادمین، الزام قطعی به تحویل کالا ایجاد نمی‌کند.

۲. پس از تأیید موجودی و قیمت، فاکتور و اطلاعات پرداخت (شبا / کارت) از طریق بله برای مشتری ارسال می‌شود. پرداخت فقط به حساب‌های اعلام‌شده در همان پیام معتبر است.

۳. مشتری موظف است پس از واریز، رسید پرداخت را در بله ارسال کند. تأیید نهایی خرید پس از بررسی رسید و ثبت شماره پیگیری توسط ادمین انجام می‌شود.

۴. زمان آماده‌سازی و ارسال بسته به موجودی و نوع کالا اعلام می‌شود. کد رهگیری ارسال پس از ارسال کالا از طریق بله و در بخش سفارش‌های سایت قابل مشاهده است.

۵. در صورت لغو سفارش پیش از تأیید پرداخت، تعهد مالی برای طرفین ایجاد نمی‌شود. پس از تأیید پرداخت، هرگونه تغییر یا مرجوعی طبق قوانین جاری و توافق با پشتیبانی بررسی می‌شود.

۶. مسئولیت صحت شماره تماس، آدرس ارسال و اطلاعات حساب کاربری بر عهده مشتری است.

۷. رفاهستون حق به‌روزرسانی این شرایط را دارد؛ نسخهٔ منتشرشده در سایت ملاک عمل است.`,
  updated_at: null,
};

export const DEMO_STORE_SETTINGS: StoreSettings = {
  ...DEFAULT_STORE_SETTINGS,
  contact_phone: "09121234567",
  order_tracking_phone: "09129876543",
  payment_sheba: "IR120170000000123456789001",
  payment_card_number: "6037-9971-1234-5678",
  payment_card_holder: "فروشگاه رفاهستون",
  bale_admin_phone: "09121234567",
  bale_products_channel_url: "https://ble.ir/refahestoon",
  bale_loan_bot_url: "https://ble.ir/refahestoon_loan",
  shipping_cost: 150000,
};

/** فقط فیلدهای عمومی برای نمایش سایت (همه به‌جز ممکن است admin phone جدا بماند — فعلاً همه عمومی‌اند چون در فوتر/تماس لازم‌اند) */
export type PublicStoreSettings = Omit<StoreSettings, "id" | "updated_at">;
