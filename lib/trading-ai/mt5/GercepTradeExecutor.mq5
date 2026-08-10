//+------------------------------------------------------------------
//| GercepTradeExecutor.mq5
//| EXECUTION_MODE = DEMO_AUTOTRADE
//|
//| Order sungguhan ke akun MT5 DEMO (bukan paper/simulation).
//| Alur: Trading Brain -> Risk Gate -> Demo Verification -> MT5 Order
//|       -> Order Confirmation -> Position Monitor -> Exit Engine
//|
//| Hard rules yang ditegakkan di EA:
//|  - MAX_POSITION = 1 (magic-filtered)
//|  - NO_AVERAGING / NO_MARTINGALE / NO_GRID / NO_HEDGE
//|  - LIVE/REAL account diblokir saat InpRequireDemo=true (default)
//|  - Satu signalId = maksimal SATU order attempt (tanpa retry otomatis)
//|  - Order hanya jalan kalau SEMUA benar:
//|      serverExecutable=true (gate demo + tombol dashboard + cooldown)
//|      eaMayExecute=true     (TRADING_AI_EA_SIGNALS=1)
//|      InpAllowTrading=true
//|      ACCOUNT_TRADE_MODE == DEMO
//|
//| Setup:
//|  1. GercepCandlePush.mq5 harus tetap jalan di chart LAIN (feed candle)
//|  2. Set InpBaseUrl + InpApiKey (gea_...)
//|  3. MT5 -> Allow WebRequest untuk base URL
//|  4. Attach ke XAUUSD, Algo Trading ON
//|  5. Nyalakan [DEMO AUTOTRADE ON] di dashboard Gercep
//+------------------------------------------------------------------
#property copyright "Gercep AI"
#property version   "2.00"
#property strict

#include <Trade/Trade.mqh>

input string InpBaseUrl      = "https://www.gercepos.id"; // MUST use www (bare domain 308-redirects)
input string InpApiKey       = "gea_PASTE_YOUR_KEY";
input string InpSymbol       = "XAUUSD";
input int    InpMagic        = 26080701;
input int    InpPollSec      = 15;
input double InpLotFallback  = 0.10;
input bool   InpAllowTrading = false; // MUST flip manually
input bool   InpRequireDemo  = true;  // hard block live by default
input int    InpSlippagePts  = 30;
input int    InpMinConfidence= 65;
input bool   InpReportOrders = true;  // kirim ORDER_STATUS ke server (cooldown + jurnal)

CTrade trade;
string g_lastSignalId    = "";
string g_attemptSignalId = "";   // signal yang SUDAH pernah dicoba — tidak diulang

string SignalUrl(const string qs)  { return InpBaseUrl + "/api/trading-ai/signal?" + qs; }
string ReportUrl()                 { return InpBaseUrl + "/api/trading-ai/order-report"; }

//| Buang spasi/kutip yang ikut ter-paste dari dashboard.
string CleanApiKey()
{
   string k = InpApiKey;
   StringTrimLeft(k);
   StringTrimRight(k);
   StringReplace(k, "\"", "");
   StringReplace(k, "'", "");
   return k;
}

string BoolStr(const bool v) { return (v ? "true" : "false"); }

bool IsDemoAccount()
{
   return (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO);
}

//| Dilaporkan ke server sebagai account_mode. Server hanya menandai
//| signal executable ketika nilainya persis "demo".
string AccountModeString()
{
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_DEMO)    return "demo";
   if(mode == ACCOUNT_TRADE_MODE_CONTEST) return "contest";
   if(mode == ACCOUNT_TRADE_MODE_REAL)    return "real";
   return "unknown";
}

long AccountLogin() { return AccountInfoInteger(ACCOUNT_LOGIN); }

int CountOurPositions()
{
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != InpSymbol) continue;
      n++;
   }
   return n;
}

bool SelectOurPosition(ulong &ticket, long &type, double &price, double &lot, double &sl, double &tp, double &pnl)
{
   ticket = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != InpSymbol) continue;
      ticket = t;
      type = PositionGetInteger(POSITION_TYPE);
      price = PositionGetDouble(POSITION_PRICE_OPEN);
      lot = PositionGetDouble(POSITION_VOLUME);
      sl = PositionGetDouble(POSITION_SL);
      tp = PositionGetDouble(POSITION_TP);
      pnl = PositionGetDouble(POSITION_PROFIT);
      return true;
   }
   return false;
}

//+------------------------------------------------------------------
//| JSON helpers (parser minimal, cukup untuk respons signal)
//+------------------------------------------------------------------
string ExtractJsonString(const string json, const string key)
{
   string needle = "\"" + key + "\":\"";
   int p = StringFind(json, needle);
   if(p < 0) return "";
   int start = p + StringLen(needle);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

bool ExtractJsonBool(const string json, const string key, const bool def)
{
   string needle = "\"" + key + "\":";
   int p = StringFind(json, needle);
   if(p < 0) return def;
   int start = p + StringLen(needle);
   while(start < StringLen(json) && StringGetCharacter(json, start) == ' ') start++;
   if(StringFind(json, "true", start) == start) return true;
   if(StringFind(json, "false", start) == start) return false;
   return def;
}

double ExtractJsonNumber(const string json, const string key, const double def)
{
   string needle = "\"" + key + "\":";
   int p = StringFind(json, needle);
   if(p < 0) return def;
   int start = p + StringLen(needle);
   while(start < StringLen(json))
   {
      ushort ch = (ushort)StringGetCharacter(json, start);
      if(ch == ' ' || ch == '\t') { start++; continue; }
      break;
   }
   if(StringFind(json, "null", start) == start) return def;
   string num = "";
   for(int i = start; i < StringLen(json); i++)
   {
      ushort ch = (ushort)StringGetCharacter(json, i);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-' || ch == '+')
         num += ShortToString(ch);
      else
         break;
   }
   if(num == "") return def;
   return StringToDouble(num);
}

//| Alasan pertama dari array executionBlockedBy — untuk baris log.
string FirstBlockReason(const string json)
{
   string needle = "\"executionBlockedBy\":[";
   int p = StringFind(json, needle);
   if(p < 0) return "";
   int start = StringFind(json, "\"", p + StringLen(needle));
   if(start < 0) return "";
   start++;
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------
//| HTTP
//+------------------------------------------------------------------
bool HttpGet(const string url, string &body)
{
   char data[];
   char result[];
   string headers = "Authorization: Bearer " + CleanApiKey() + "\r\n";
   string result_headers;
   int code = WebRequest("GET", url, headers, 8000, data, result, result_headers);
   if(code == -1)
   {
      Print("Gercep signal WebRequest failed. Err=", GetLastError(), " — allow URL: ", InpBaseUrl);
      return false;
   }
   body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code < 200 || code >= 300)
   {
      Print("Gercep signal HTTP ", code, " ", body);
      return false;
   }
   return true;
}

bool HttpPostJson(const string url, const string json)
{
   char data[];
   char result[];
   string result_headers;
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1); // buang null terminator
   string headers = "Authorization: Bearer " + CleanApiKey() + "\r\n"
                    "Content-Type: application/json\r\n";
   int code = WebRequest("POST", url, headers, 8000, data, result, result_headers);
   if(code == -1)
   {
      Print("Order report WebRequest failed. Err=", GetLastError());
      return false;
   }
   if(code < 200 || code >= 300)
   {
      Print("Order report HTTP ", code, " ",
            CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
      return false;
   }
   return true;
}

//| Lapor hasil eksekusi ke server. Ini yang menyalakan cooldown dan
//| mengisi jurnal order di dashboard.
void ReportOrder(const string signalId, const string status, const string direction,
                 const double lot, const long ticket, const double entryPrice,
                 const double spreadPts, const double confidence,
                 const int errorCode, const string errorMessage)
{
   if(!InpReportOrders) return;
   string json = StringFormat(
      "{\"signalId\":\"%s\",\"status\":\"%s\",\"symbol\":\"%s\",\"direction\":\"%s\","
      "\"lot\":%.2f,\"ticket\":%d,\"entryPrice\":%.5f,\"spread\":%.0f,\"confidence\":%.1f,"
      "\"accountMode\":\"%s\",\"accountLogin\":%d,\"errorCode\":%d,\"errorMessage\":\"%s\"}",
      signalId, status, InpSymbol, direction, lot, ticket, entryPrice, spreadPts,
      confidence, AccountModeString(), AccountLogin(), errorCode, errorMessage);
   HttpPostJson(ReportUrl(), json);
}

//+------------------------------------------------------------------
//| ORDER VALIDATION LOG — dicetak sebelum setiap percobaan order
//+------------------------------------------------------------------
void PrintValidationBlock(const string decision, const double lot, const double spreadPts,
                          const string m5Bias, const string m1Dir, const double confidence,
                          const bool riskGatePass, const string executionStatus)
{
   Print("---- GERCEP ORDER VALIDATION ----");
   Print("ACCOUNT_MODE=", AccountModeString());
   Print("ACCOUNT_LOGIN=", AccountLogin());
   Print("SYMBOL=", InpSymbol);
   Print("SIGNAL=", decision);
   Print("LOT=", DoubleToString(lot, 2));
   Print("SPREAD=", DoubleToString(spreadPts, 0));
   Print("M5_BIAS=", m5Bias);
   Print("M1_DIRECTION=", m1Dir);
   Print("CONFIDENCE=", DoubleToString(confidence, 1));
   Print("DECISION=", decision);
   Print("RISK_GATE=", (riskGatePass ? "PASS" : "BLOCK"));
   Print("EXECUTION_STATUS=", executionStatus);
   Print("---------------------------------");
}

void PrintFilled(const long ticket, const string direction, const double entryPrice,
                 const double lot, const double spreadPts)
{
   Print("ORDER_STATUS=FILLED");
   Print("TICKET=", ticket);
   Print("DIRECTION=", direction);
   Print("ENTRY_PRICE=", DoubleToString(entryPrice, 5));
   Print("LOT=", DoubleToString(lot, 2));
   Print("SPREAD=", DoubleToString(spreadPts, 0));
   Print("TIME=", TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));
}

void PrintFailed(const int errorCode, const string errorMessage)
{
   Print("ORDER_STATUS=FAILED");
   Print("ERROR_CODE=", errorCode);
   Print("ERROR_MESSAGE=", errorMessage);
}

//+------------------------------------------------------------------
//| EXIT ENGINE — kirim CLOSE ke akun DEMO
//+------------------------------------------------------------------
void CloseOurPosition(const string signalId, const double spreadPts, const double confidence)
{
   ulong ticket; long type; double price, lot, sl, tp, pnl;
   if(!SelectOurPosition(ticket, type, price, lot, sl, tp, pnl))
   {
      Print("CLOSE diminta tapi tidak ada posisi milik EA. Skip.");
      return;
   }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePts);

   if(!trade.PositionClose(ticket))
   {
      PrintFailed((int)trade.ResultRetcode(), trade.ResultRetcodeDescription());
      ReportOrder(signalId, "CLOSE_FAILED", "CLOSE", lot, (long)ticket, price, spreadPts,
                  confidence, (int)trade.ResultRetcode(), trade.ResultRetcodeDescription());
      return;
   }

   Print("ORDER_STATUS=CLOSED");
   Print("TICKET=", (long)ticket);
   Print("DIRECTION=", (type == POSITION_TYPE_BUY ? "BUY" : "SELL"));
   Print("LOT=", DoubleToString(lot, 2));
   Print("PROFIT=", DoubleToString(pnl, 2));
   Print("TIME=", TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));
   ReportOrder(signalId, "CLOSED", "CLOSE", lot, (long)ticket, price, spreadPts,
               confidence, 0, "");
}

//+------------------------------------------------------------------
//| ENTRY — satu attempt, tanpa retry
//+------------------------------------------------------------------
double NormalizeLot(const double lot)
{
   double volume = (lot > 0 ? lot : InpLotFallback);
   double minLot = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_STEP);
   if(step <= 0) step = 0.01;
   volume = MathMax(minLot, MathMin(maxLot, volume));
   volume = MathFloor(volume / step + 1e-9) * step;
   return volume;
}

void OpenSide(const string signalId, const string decision, const double lot,
              const double sl, const double tp, const double spreadPts,
              const double confidence)
{
   // MAX_POSITION = 1. Dicek ulang tepat sebelum kirim (NO_AVERAGING / NO_GRID / NO_HEDGE).
   if(CountOurPositions() > 0)
   {
      Print("MAX_POSITION=1 — posisi masih terbuka, entry dibatalkan.");
      return;
   }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePts);
   trade.SetTypeFillingBySymbol(InpSymbol);

   double volume = NormalizeLot(lot);
   bool ok = false;
   if(decision == "BUY")
      ok = trade.Buy(volume, InpSymbol, 0, sl, tp, "Gercep Brain BUY");
   else if(decision == "SELL")
      ok = trade.Sell(volume, InpSymbol, 0, sl, tp, "Gercep Brain SELL");
   else
      return;

   if(!ok)
   {
      PrintFailed((int)trade.ResultRetcode(), trade.ResultRetcodeDescription());
      ReportOrder(signalId, "FAILED", decision, volume, 0, 0, spreadPts, confidence,
                  (int)trade.ResultRetcode(), trade.ResultRetcodeDescription());
      return;
   }

   long ticket = (long)trade.ResultOrder();
   double entryPrice = trade.ResultPrice();
   PrintFilled(ticket, decision, entryPrice, volume, spreadPts);
   ReportOrder(signalId, "FILLED", decision, volume, ticket, entryPrice, spreadPts,
               confidence, 0, "");
}

//+------------------------------------------------------------------
//| MAIN LOOP
//+------------------------------------------------------------------
void PollAndAct()
{
   if(StringFind(CleanApiKey(), "gea_") != 0)
   {
      Print("Set InpApiKey (gea_...) dari dashboard Gercep.");
      return;
   }

   // DEMO ACCOUNT VERIFICATION — sebelum apa pun.
   if(InpRequireDemo && !IsDemoAccount())
   {
      Print("LIVE/REAL account terdeteksi — STOP ENTRY. mode=", AccountModeString(),
            " login=", AccountLogin());
      return;
   }

   double bid       = SymbolInfoDouble(InpSymbol, SYMBOL_BID);
   double ask       = SymbolInfoDouble(InpSymbol, SYMBOL_ASK);
   double point     = SymbolInfoDouble(InpSymbol, SYMBOL_POINT);
   double spreadPts = (point > 0) ? (ask - bid) / point : 0;
   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);

   // POSITION MONITOR — kirim posisi berjalan supaya Brain memutuskan HOLD/CLOSE
   // dan Risk Gate tahu MAX_POSITION sudah terpakai.
   string open_side = "none";
   string open_qs = "";
   ulong ticket; long type; double oprice, olot, osl, otp, opnl;
   bool hasPosition = SelectOurPosition(ticket, type, oprice, olot, osl, otp, opnl);
   if(hasPosition)
   {
      open_side = (type == POSITION_TYPE_BUY ? "BUY" : "SELL");
      open_qs =
         "&open_side="   + open_side +
         "&open_price="  + DoubleToString(oprice, 5) +
         "&open_lot="    + DoubleToString(olot, 2) +
         "&open_ticket=" + IntegerToString((long)ticket) +
         "&open_sl="     + DoubleToString(osl, 5) +
         "&open_tp="     + DoubleToString(otp, 5) +
         "&open_pnl="    + DoubleToString(opnl, 2);
   }

   string qs = StringFormat(
      "symbol=%s&account_mode=%s&account_login=%d&bid=%.5f&ask=%.5f&spread=%.0f&balance=%.2f%s",
      InpSymbol, AccountModeString(), AccountLogin(), bid, ask, spreadPts, balance, open_qs
   );

   string body;
   if(!HttpGet(SignalUrl(qs), body)) return;

   string decision  = ExtractJsonString(body, "decision");
   string signalId  = ExtractJsonString(body, "signalId");
   string m5Bias    = ExtractJsonString(body, "m5Bias");
   string m1Dir     = ExtractJsonString(body, "m1Direction");
   bool   eaMay     = ExtractJsonBool(body, "eaMayExecute", false);
   bool   srvExec   = ExtractJsonBool(body, "serverExecutable", false);
   bool   autotrade = ExtractJsonBool(body, "autotrade", false);
   bool   estop     = ExtractJsonBool(body, "emergencyStop", false);
   double cooldown  = ExtractJsonNumber(body, "cooldownRemaining", 0);
   double confidence= ExtractJsonNumber(body, "confidence", 0);
   double lot       = ExtractJsonNumber(body, "lot", InpLotFallback);
   double sl        = ExtractJsonNumber(body, "stopLoss", 0);
   double tp        = ExtractJsonNumber(body, "takeProfit", 0);

   Print("Signal id=", signalId, " decision=", decision,
         " conf=", DoubleToString(confidence, 1),
         " spread=", DoubleToString(spreadPts, 0),
         " srvExec=", BoolStr(srvExec), " eaMay=", BoolStr(eaMay),
         " autotrade=", BoolStr(autotrade), " estop=", BoolStr(estop),
         " cooldown=", DoubleToString(cooldown, 0),
         " mode=", AccountModeString(), " pos=", CountOurPositions());

   if(decision == "" || decision == "WAIT")
   {
      g_lastSignalId = signalId;
      return;
   }

   // Satu signal = maksimal satu order attempt. Tanpa retry otomatis.
   if(signalId != "" && signalId == g_attemptSignalId)
      return;

   // Kumpulkan status blok sebelum mencetak blok validasi.
   string executionStatus = "READY";
   if(!InpAllowTrading)
      executionStatus = "BLOCKED:InpAllowTrading=false";
   else if(!eaMay)
      executionStatus = "BLOCKED:server eaMayExecute=false (TRADING_AI_EA_SIGNALS)";
   else if(!srvExec)
   {
      string why = FirstBlockReason(body);
      executionStatus = "BLOCKED:" + (why == "" ? "serverExecutable=false" : why);
   }
   else if(!IsDemoAccount())
      executionStatus = "BLOCKED:account bukan DEMO";
   else if(decision != "CLOSE" && confidence < InpMinConfidence)
      executionStatus = StringFormat("BLOCKED:confidence %.1f < %d", confidence, InpMinConfidence);
   else if(decision != "CLOSE" && CountOurPositions() > 0)
      executionStatus = "BLOCKED:MAX_POSITION=1 sudah terpakai";

   PrintValidationBlock(decision, (decision == "CLOSE" ? olot : NormalizeLot(lot)),
                        spreadPts, m5Bias, m1Dir, confidence, srvExec, executionStatus);

   if(executionStatus != "READY")
   {
      g_lastSignalId = signalId;
      return;
   }

   // Ditandai SEBELUM kirim: kalau order gagal, tidak ada percobaan ulang
   // untuk signal yang sama. Signal berikutnya datang dari bar M1 baru.
   g_attemptSignalId = signalId;
   g_lastSignalId = signalId;

   if(decision == "CLOSE")
      CloseOurPosition(signalId, spreadPts, confidence);
   else if(decision == "BUY" || decision == "SELL")
      OpenSide(signalId, decision, lot, (sl > 0 ? sl : 0), (tp > 0 ? tp : 0), spreadPts, confidence);
}

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   EventSetTimer(MathMax(5, InpPollSec));
   Print("GercepTradeExecutor v2 — EXECUTION_MODE=DEMO_AUTOTRADE");
   Print("account_mode=", AccountModeString(), " login=", AccountLogin(),
         " demoOnly=", BoolStr(InpRequireDemo), " allowTrading=", BoolStr(InpAllowTrading),
         " lot=", DoubleToString(InpLotFallback, 2));
   if(InpRequireDemo && !IsDemoAccount())
      Print("PERINGATAN: akun bukan DEMO. EA tidak akan mengirim order.");
   PollAndAct();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PollAndAct();
}

void OnTick()
{
   // timer-driven
}
