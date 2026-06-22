export const CATALOG_URL         = 'https://docs.google.com/spreadsheets/d/1Vc3X0RI50pBOQpJUlLwSywAR9twlG4dSaoqONnRf2Ck/export?format=csv&gid=0';
export const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product/';
export const SHEET_APPEND_URL    = 'https://script.google.com/macros/s/AKfycbztMwSVooLa8kyrfc4w8nwozximqD_mwDztLQ4lvAY99MvUr6pgsS9Pt5i1F-D_nUoiQg/exec';
export const INVENTARI_URL       = 'https://docs.google.com/spreadsheets/d/1Vc3X0RI50pBOQpJUlLwSywAR9twlG4dSaoqONnRf2Ck/export?format=csv&gid=1640722155';

export const STORAGE_ITEMS          = 'uauu_inv_items';
export const STORAGE_CATS           = 'uauu_inv_cats';
export const STORAGE_ORDERS         = 'uauu_inv_orders';
export const STORAGE_CAT_EXTRA      = 'uauu_inv_catalog_extra';
export const STORAGE_MASIA          = 'uauu_inv_masia';
export const STORAGE_ACCESS_TOKEN   = 'uauu_inv_access_token';
export const STORAGE_REFRESH_TOKEN  = 'uauu_inv_refresh_token';
export const STORAGE_TOKEN_EXPIRES  = 'uauu_inv_token_expires';
export const STORAGE_USER_PROFILE   = 'uauu_inv_user_profile';

export const SUPABASE_URL     = 'https://oeriszeicvdnagohnqvq.supabase.co';
export const SUPABASE_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcmlzemVpY3ZkbmFnb2hucXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjM2MTAsImV4cCI6MjA5NzMzOTYxMH0.GyZe8TDZus51kyYeOViZMPKxXYHlynfvJiJ83S_2cu0';
export const MANAGE_USERS_URL = SUPABASE_URL + '/functions/v1/manage-users';

export const STATUS_LABELS = {
  pendent:       'Pendent',
  en_curs:       'En curs',
  rebuda:        'Rebuda',
  'cancel·lada': 'Cancel·lada',
};

export const MASIA_LABELS = {
  'ca-nalzina':      "Ca n'Alzina",
  'can-macia':       'Can Macià',
  'castell-de-tous': 'Castell de Tous',
  'mas-vivencs':     'Mas Vivencs',
};

export const MASIA_COLORS = {
  'ca-nalzina':      '#B0B8C8',
  'can-macia':       '#CEB08C',
  'castell-de-tous': '#A8C4A0',
  'mas-vivencs':     '#C8A8B8',
};

export const STATUS_CSS = {
  pendent:       'status-pendent',
  en_curs:       'status-en_curs',
  rebuda:        'status-rebuda',
  'cancel·lada': 'status-cancel_lada',
};

export const CAT_COLORS = [
  '#B8A99A', '#A4B5A8', '#B0B4C8', '#C8B0B0',
  '#C8C4B0', '#A8C4B8', '#CEB08C', '#B0B8A4',
];

export const DEFAULT_CATS = [
  { id: 'cat_general', name: 'General', color: '#B8A99A' },
];

export const state = {
  items:             [],
  categories:        [],
  view:              'list',
  search:            '',
  filter:            null,
  editingId:         null,
  searchOpen:        false,
  selColor:          CAT_COLORS[0],
  user:              null,
  masia:             null,
  catalog:           [],
  catalogReady:      false,
  orders:            [],
  orderFilter:       '',
  editingOrderId:    null,
  importRows:        [],
  editingCatalogIdx: null,
  catalogExtra:      [],
  maxCatalogId:      0,
  scannerInstance:   null,
  authProfile:       null,
  accessToken:       null,
  usersCache:        null,
  editingUserId:     null,
};

const _itemsKey = () => state.masia ? `${STORAGE_ITEMS}_${state.masia}` : STORAGE_ITEMS;
const _catsKey  = () => state.masia ? `${STORAGE_CATS}_${state.masia}`  : STORAGE_CATS;

export function loadData() {
  try {
    state.items        = JSON.parse(localStorage.getItem(_itemsKey()))       || [];
    state.categories   = JSON.parse(localStorage.getItem(_catsKey()))        || [...DEFAULT_CATS];
    state.orders       = JSON.parse(localStorage.getItem(STORAGE_ORDERS))    || [];
    state.catalogExtra = JSON.parse(localStorage.getItem(STORAGE_CAT_EXTRA)) || [];
  } catch {
    state.items        = [];
    state.categories   = [...DEFAULT_CATS];
    state.orders       = [];
    state.catalogExtra = [];
  }
}

export function saveItems()  { localStorage.setItem(_itemsKey(), JSON.stringify(state.items)); }
export function saveCats()   { localStorage.setItem(_catsKey(),  JSON.stringify(state.categories)); }
export function saveOrders() { localStorage.setItem(STORAGE_ORDERS, JSON.stringify(state.orders)); }
