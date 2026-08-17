//+------------------------------------------------------------------
//| GercepCandlePush.mq5
//| Push gold M5 + M1 candles to Gercep Trading AI (read-only).
//| DOES NOT PLACE ORDERS.
//|
//| Setup:
//| 1. Dashboard Gercep → Trading AI Brain → buat API key (gea_...)
//| 2. Paste key to InpApiKey below
//| 3. Set InpBaseUrl = https://www.gercepos.id  (www required)
//| 4. MT5 → Tools → Options → Expert Advisors
//|    ☑ Allow WebRequest for listed URL → add same base URL
//| 5. Attach EA to gold chart (XAUUSD / XAUUSDm / dll). Algo Trading ON.
//| 6. InpSymbol kosong = ikut simbol chart (disarankan di Exness).
//+------------------------------------------------------------------
#property copyright "Gercep AI"
#property version   "1.10"

input string InpBaseUrl   = "https://www.gercepos.id"; // MUST use www (bare domain 308-redirects)
input string InpApiKey    = "gea_PASTE_YOUR_KEY";
input string InpSymbol    = ""; // kosong = _Symbol (XAUUSDm di Exness OK)
input int    InpBarsM5    = 80;
input int    InpBarsM1    = 120;
input int    InpTimerSec  = 30; // push interval

string Endpoint()
{
   return InpBaseUrl + "/api/trading-ai/ingest";
}

//| Simbol broker untuk CopyRates / chart.
string BrokerSymbol()
{
   string s = InpSymbol;
   StringTrimLeft(s);
   StringTrimRight(s);
   if(s == "" || s == "auto" || s == "AUTO")
      return _Symbol;
   return s;
}

//| Simbol kanonik ke Gercep (otak selalu XAUUSD).
string ApiSymbol(const string brokerSym)
{
   string u = brokerSym;
   StringToUpper(u);
   if(StringFind(u, "XAU") == 0 || StringFind(u, "GOLD") >= 0)
      return "XAUUSD";
   return brokerSym;
}

string EscapeJson(const string s)
{
   string o = s;
   StringReplace(o, "\\", "\\\\");
   StringReplace(o, "\"", "\\\"");
   return o;
}

string BuildCandleJson(const string brokerSym, const string apiSym, ENUM_TIMEFRAMES tf, const int bars)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(brokerSym, tf, 0, bars, rates);
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

   // oldest → newest
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
   // remove trailing null from StringToCharArray
   int len = ArraySize(data);
   if(len > 0 && data[len - 1] == 0) ArrayResize(data, len - 1);

   string result_headers;
   int code = WebRequest("POST", Endpoint(), headers, 8000, data, result, result_headers);
   if(code == -1)
   {
      Print("Gercep WebRequest failed. Err=", GetLastError(),
            " — add URL to Tools→Options→Expert Advisors→Allow WebRequest: ", InpBaseUrl);
      return false;
   }
   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   Print("Gercep ingest HTTP ", code, " ", body);
   return (code >= 200 && code < 300);
}

string CleanApiKey()
{
   string key = InpApiKey;
   StringTrimLeft(key);
   StringTrimRight(key);
   // strip accidental quotes from paste
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
      Print("Set InpApiKey from Gercep dashboard (starts with gea_). len=",
            StringLen(key), " head=", StringSubstr(key, 0, MathMin(8, StringLen(key))));
      return;
   }

   string brokerSym = BrokerSymbol();
   string apiSym = ApiSymbol(brokerSym);
   if(!SymbolSelect(brokerSym, true))
   {
      Print("SymbolSelect gagal — pastikan ", brokerSym, " ada di Market Watch.");
      return;
   }

   string j5 = BuildCandleJson(brokerSym, apiSym, PERIOD_M5, InpBarsM5);
   string j1 = BuildCandleJson(brokerSym, apiSym, PERIOD_M1, InpBarsM1);
   if(j5 == "" || j1 == "")
   {
      Print("CopyRates failed — broker=", brokerSym, " api=", apiSym,
            " err=", GetLastError());
      return;
   }
   PostJsonWithKey(j5, key);
   PostJsonWithKey(j1, key);
}

int OnInit()
{
   EventSetTimer(MathMax(10, InpTimerSec));
   Print("GercepCandlePush v1.1 broker=", BrokerSymbol(),
         " api=", ApiSymbol(BrokerSymbol()));
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
   // timer-driven; keep OnTick empty (no trading)
}
