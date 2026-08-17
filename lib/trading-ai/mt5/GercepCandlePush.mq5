//+------------------------------------------------------------------
//| GercepCandlePush.mq5
//| Push gold M5 + M1 candles to Gercep Trading AI (read-only).
//| DOES NOT PLACE ORDERS.
//|
//| EXNESS DEMO:
//|  - Simbol biasanya XAUUSDm (bukan XAUUSD)
//|  - InpSymbol kosong = ikut chart. Kalau masih "XAUUSD" tersimpan di
//|    properties chart, EA otomatis fallback ke simbol chart / XAUUSDm.
//|
//| Setup:
//| 1. Dashboard → buat API key (gea_...)
//| 2. InpBaseUrl = https://www.gercepos.id
//| 3. Tools → Options → Expert Advisors → Allow WebRequest → URL di atas
//| 4. Attach ke chart XAUUSDm (M1 atau M5). Algo Trading ON.
//| 5. Compile ke folder Experts/Advisors (Navigator pakai Advisors)
//+------------------------------------------------------------------
#property copyright "Gercep AI"
#property version   "1.20"

input string InpBaseUrl   = "https://www.gercepos.id";
input string InpApiKey    = "gea_PASTE_YOUR_KEY";
input string InpSymbol    = ""; // kosong / auto = chart. Jangan hardcode XAUUSD di Exness.
input int    InpBarsM5    = 80;
input int    InpBarsM1    = 120;
input int    InpTimerSec  = 30;

string g_brokerSym = "";
string g_apiSym    = "XAUUSD";

string Endpoint() { return InpBaseUrl + "/api/trading-ai/ingest"; }

string EscapeJson(const string s)
{
   string o = s;
   StringReplace(o, "\\", "\\\\");
   StringReplace(o, "\"", "\\\"");
   return o;
}

bool LooksLikeGold(const string sym)
{
   string u = sym;
   StringToUpper(u);
   return (StringFind(u, "XAU") == 0 || StringFind(u, "GOLD") >= 0);
}

string ToApiSymbol(const string brokerSym)
{
   if(LooksLikeGold(brokerSym)) return "XAUUSD";
   return brokerSym;
}

bool SymbolUsable(const string sym)
{
   if(sym == "") return false;
   if(!SymbolSelect(sym, true)) return false;
   MqlTick tick;
   if(!SymbolInfoTick(sym, tick)) return false;
   // Cukup ada 1 bar M1 = simbol hidup di terminal.
   if(Bars(sym, PERIOD_M1) <= 0 && Bars(sym, PERIOD_M5) <= 0) return false;
   return true;
}

//| Cari simbol gold yang benar di Exness / broker lain.
string ResolveBrokerSymbol()
{
   string preferred = InpSymbol;
   StringTrimLeft(preferred);
   StringTrimRight(preferred);

   // 1) Chart symbol kalau gold (paling aman di Exness).
   if(LooksLikeGold(_Symbol) && SymbolUsable(_Symbol))
   {
      if(preferred != "" && preferred != _Symbol && preferred != "auto" && preferred != "AUTO")
         Print("InpSymbol=", preferred, " diabaikan — pakai chart ", _Symbol);
      return _Symbol;
   }

   // 2) Input manual kalau valid.
   if(preferred != "" && preferred != "auto" && preferred != "AUTO" && SymbolUsable(preferred))
      return preferred;

   // 3) Kandidat umum Exness / broker.
   string candidates[6];
   candidates[0] = "XAUUSDm";
   candidates[1] = "XAUUSD";
   candidates[2] = "XAUUSD.m";
   candidates[3] = "XAUUSDc";
   candidates[4] = "GOLD";
   candidates[5] = _Symbol;
   for(int i = 0; i < 6; i++)
   {
      if(SymbolUsable(candidates[i]))
      {
         Print("Auto-pilih simbol gold: ", candidates[i]);
         return candidates[i];
      }
   }
   return "";
}

int CopyRatesRetry(const string symbol, ENUM_TIMEFRAMES tf, const int bars, MqlRates &rates[])
{
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, tf, 0, bars, rates);
   if(copied > 0) return copied;

   // Paksa terminal unduh history, lalu coba lagi.
   int have = Bars(symbol, tf);
   Print("CopyRates pertama gagal tf=", EnumToString(tf),
         " haveBars=", have, " err=", GetLastError(), " — retry...");
   Sleep(300);
   ResetLastError();
   copied = CopyRates(symbol, tf, 0, bars, rates);
   return copied;
}

string BuildCandleJson(const string brokerSym, const string apiSym, ENUM_TIMEFRAMES tf, const int bars)
{
   MqlRates rates[];
   int copied = CopyRatesRetry(brokerSym, tf, bars, rates);
   if(copied <= 0) return "";

   string tfStr = (tf == PERIOD_M5 ? "M5" : "M1");
   long brokerTime = (long)TimeCurrent();
   int gmtOffsetSec = (int)(TimeCurrent() - TimeGMT());
   string json = "{";
   json += "\"symbol\":\"" + EscapeJson(apiSym) + "\",";
   json += "\"timeframe\":\"" + tfStr + "\",";
   json += "\"brokerTime\":" + IntegerToString(brokerTime) + ",";
   json += "\"gmtOffsetSec\":" + IntegerToString(gmtOffsetSec) + ",";
   json += "\"candles\":[";

   for(int i = copied - 1; i >= 0; i--)
   {
      if(i < copied - 1) json += ",";
      json += "{";
      json += "\"time\":" + IntegerToString((long)rates[i].time) + ",";
      json += "\"open\":" + DoubleToString(rates[i].open, 3) + ",";
      json += "\"high\":" + DoubleToString(rates[i].high, 3) + ",";
      json += "\"low\":" + DoubleToString(rates[i].low, 3) + ",";
      json += "\"close\":" + DoubleToString(rates[i].close, 3) + ",";
      json += "\"volume\":" + DoubleToString((double)rates[i].tick_volume, 0);
      json += "}";
   }
   json += "]}";
   return json;
}

bool PostJsonWithKey(const string payload, const string apiKey)
{
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + apiKey + "\r\n";
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   int len = ArraySize(data);
   if(len > 0 && data[len - 1] == 0) ArrayResize(data, len - 1);

   string result_headers;
   int code = WebRequest("POST", Endpoint(), headers, 8000, data, result, result_headers);
   if(code == -1)
   {
      Print("Gercep WebRequest failed. Err=", GetLastError(),
            " — Allow WebRequest: ", InpBaseUrl);
      return false;
   }
   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   Print("Gercep ingest HTTP ", code, " ", body);
   if(code < 200 || code >= 300)
   {
      Print("INGEST GAGAL code=", code,
            " — cek Peralatan→Opsi→Expert Advisors→Allow WebRequest berisi persis: ",
            InpBaseUrl);
      if(code == 1003)
         Print("HTTP 1003 sering = Cloudflare/akses URL salah. Pastikan pakai https://www.gercepos.id (ada www).");
   }
   return (code >= 200 && code < 300);
}

string CleanApiKey()
{
   string key = InpApiKey;
   StringTrimLeft(key);
   StringTrimRight(key);
   if(StringLen(key) >= 2)
   {
      ushort a = StringGetCharacter(key, 0);
      ushort b = StringGetCharacter(key, StringLen(key) - 1);
      if((a == '"' && b == '"') || (a == '\'' && b == '\''))
         key = StringSubstr(key, 1, StringLen(key) - 2);
      StringTrimLeft(key);
      StringTrimRight(key);
   }
   return key;
}

bool ApiKeyOk(const string key)
{
   return (StringLen(key) > 8 && StringFind(key, "gea_") == 0);
}

void PushAll()
{
   string key = CleanApiKey();
   if(!ApiKeyOk(key))
   {
      Print("Set InpApiKey (gea_...) dari dashboard. len=",
            StringLen(key), " head=", StringSubstr(key, 0, MathMin(8, StringLen(key))));
      return;
   }

   if(g_brokerSym == "")
   {
      g_brokerSym = ResolveBrokerSymbol();
      g_apiSym = ToApiSymbol(g_brokerSym);
   }
   if(g_brokerSym == "")
   {
      Print("Tidak ketemu simbol gold. Buka chart XAUUSDm dulu.");
      return;
   }

   string j5 = BuildCandleJson(g_brokerSym, g_apiSym, PERIOD_M5, InpBarsM5);
   string j1 = BuildCandleJson(g_brokerSym, g_apiSym, PERIOD_M1, InpBarsM1);
   if(j5 == "" || j1 == "")
   {
      Print("CopyRates failed broker=", g_brokerSym, " api=", g_apiSym,
            " err=", GetLastError(), " — coba scroll chart supaya history terunduh.");
      // Reset supaya next tick coba resolve ulang (mis. ganti chart).
      g_brokerSym = "";
      return;
   }
   PostJsonWithKey(j5, key);
   PostJsonWithKey(j1, key);
}

int OnInit()
{
   g_brokerSym = ResolveBrokerSymbol();
   g_apiSym = ToApiSymbol(g_brokerSym);
   EventSetTimer(MathMax(10, InpTimerSec));
   Print("==== GercepCandlePush v1.2 EXNESS ====");
   Print("chart=", _Symbol, " broker=", g_brokerSym, " api=", g_apiSym);
   Print("baseUrl=", InpBaseUrl);
   if(g_brokerSym == "")
      Print("GAGAL resolve simbol — attach EA ke chart XAUUSDm.");
   PushAll();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PushAll();
}

void OnTick()
{
}
