using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Services;

// ═══════════════════════════════════════════════════════════════════════════
// Formül ağacı — ham veriden indikatör inşa etmek için gereken en küçük dil
// ═══════════════════════════════════════════════════════════════════════════
//
// Hiçbir hazır indikatör (RSI, MACD, ADX...) yapı taşı olarak verilmez.
// Elde yalnızca ham mum alanları ve genel matematik/pencere işlemleri vardır.
// Sistem bunları birleştirerek kendi formülünü kurar.
//
// Not: Evrim bazen bilinen bir indikatöre benzeyen formüller üretir. Bu bir
// kusur değil — o indikatörler de aynı ham malzemeden, benzer gerekçelerle
// türetilmiştir. Fark, burada formülün verilmemiş, BULUNMUŞ olmasıdır.

/// <summary>Formül ağacının bir düğümü. Tüm seriyi tek seferde hesaplar (vektörel).</summary>
public abstract class FormulaNode
{
    public abstract double[] Evaluate(PriceSeries s);
    public abstract string ToText();
    public abstract int Size { get; }
    public abstract FormulaNode Clone();
}

/// <summary>Ham fiyat serileri. Evrim sırasında binlerce kez okunur, double kullanılır.</summary>
public sealed class PriceSeries
{
    public required double[] Open { get; init; }
    public required double[] High { get; init; }
    public required double[] Low { get; init; }
    public required double[] Close { get; init; }
    public required double[] Volume { get; init; }
    public int Length => Close.Length;

    public static PriceSeries From(IReadOnlyList<CandleInput> c) => new()
    {
        Open   = [.. c.Select(x => (double)x.Open)],
        High   = [.. c.Select(x => (double)x.High)],
        Low    = [.. c.Select(x => (double)x.Low)],
        Close  = [.. c.Select(x => (double)x.Close)],
        Volume = [.. c.Select(x => (double)x.Volume)],
    };
}

public enum PriceField { Open, High, Low, Close, Volume }

public sealed class PriceNode(PriceField field) : FormulaNode
{
    public PriceField Field { get; } = field;
    public override int Size => 1;

    public override double[] Evaluate(PriceSeries s) => Field switch
    {
        PriceField.Open   => s.Open,
        PriceField.High   => s.High,
        PriceField.Low    => s.Low,
        PriceField.Volume => s.Volume,
        _                 => s.Close,
    };

    public override string ToText() => Field switch
    {
        PriceField.Open   => "açılış",
        PriceField.High   => "yüksek",
        PriceField.Low    => "düşük",
        PriceField.Volume => "hacim",
        _                 => "kapanış",
    };

    public override FormulaNode Clone() => new PriceNode(Field);
}

public sealed class ConstNode(double value) : FormulaNode
{
    public double Value { get; } = value;
    public override int Size => 1;

    public override double[] Evaluate(PriceSeries s)
    {
        var a = new double[s.Length];
        Array.Fill(a, Value);
        return a;
    }

    public override string ToText() => Value.ToString("0.###");
    public override FormulaNode Clone() => new ConstNode(Value);
}

public enum WindowOp { Ortalama, EnYuksek, EnDusuk, Sapma, Gecikme, Degisim }

/// <summary>Pencere işlemi: son N barın ortalaması, en yükseği, değişimi...</summary>
public sealed class WindowNode(WindowOp op, int period, FormulaNode child) : FormulaNode
{
    public WindowOp Op { get; } = op;
    public int Period { get; } = period;
    public FormulaNode Child { get; set; } = child;
    public override int Size => 1 + Child.Size;

    public override double[] Evaluate(PriceSeries s)
    {
        var x = Child.Evaluate(s);
        var n = x.Length;
        var r = new double[n];
        var p = Period;

        switch (Op)
        {
            case WindowOp.Gecikme:
                for (var i = 0; i < n; i++) r[i] = i >= p ? x[i - p] : x[i];
                return r;

            case WindowOp.Degisim:
                for (var i = 0; i < n; i++) r[i] = i >= p ? x[i] - x[i - p] : 0;
                return r;

            case WindowOp.Ortalama:
            {
                double sum = 0;
                for (var i = 0; i < n; i++)
                {
                    sum += x[i];
                    if (i >= p) sum -= x[i - p];
                    r[i] = i >= p - 1 ? sum / p : x[i];
                }
                return r;
            }

            case WindowOp.EnYuksek:
            case WindowOp.EnDusuk:
            {
                var max = Op == WindowOp.EnYuksek;
                for (var i = 0; i < n; i++)
                {
                    var from = Math.Max(0, i - p + 1);
                    var best = x[from];
                    for (var k = from + 1; k <= i; k++)
                        if (max ? x[k] > best : x[k] < best) best = x[k];
                    r[i] = best;
                }
                return r;
            }

            default: // Sapma
            {
                for (var i = 0; i < n; i++)
                {
                    var from = Math.Max(0, i - p + 1);
                    var cnt = i - from + 1;
                    double sum = 0;
                    for (var k = from; k <= i; k++) sum += x[k];
                    var mean = sum / cnt;
                    double sq = 0;
                    for (var k = from; k <= i; k++) { var d = x[k] - mean; sq += d * d; }
                    r[i] = Math.Sqrt(sq / cnt);
                }
                return r;
            }
        }
    }

    public override string ToText()
    {
        var name = Op switch
        {
            WindowOp.Ortalama => "ort",
            WindowOp.EnYuksek => "enyüksek",
            WindowOp.EnDusuk  => "endüşük",
            WindowOp.Sapma    => "sapma",
            WindowOp.Gecikme  => "gecikme",
            _                 => "değişim",
        };
        return $"{name}({Child.ToText()}, {Period})";
    }

    public override FormulaNode Clone() => new WindowNode(Op, Period, Child.Clone());
}

public enum BinaryOp { Topla, Cikar, Carp, Bol, Oran }

public sealed class BinaryNode(BinaryOp op, FormulaNode left, FormulaNode right) : FormulaNode
{
    public BinaryOp Op { get; } = op;
    public FormulaNode Left { get; set; } = left;
    public FormulaNode Right { get; set; } = right;
    public override int Size => 1 + Left.Size + Right.Size;

    private const double Eps = 1e-9;

    public override double[] Evaluate(PriceSeries s)
    {
        var a = Left.Evaluate(s);
        var b = Right.Evaluate(s);
        var n = a.Length;
        var r = new double[n];

        for (var i = 0; i < n; i++)
        {
            r[i] = Op switch
            {
                BinaryOp.Topla => a[i] + b[i],
                BinaryOp.Cikar => a[i] - b[i],
                BinaryOp.Carp  => a[i] * b[i],
                // Sıfıra bölme formülü çöpe atmasın diye korumalı bölme
                BinaryOp.Bol   => Math.Abs(b[i]) < Eps ? 0 : a[i] / b[i],
                _              => Math.Abs(b[i]) < Eps ? 0 : (a[i] - b[i]) / Math.Abs(b[i]),
            };
            if (double.IsNaN(r[i]) || double.IsInfinity(r[i])) r[i] = 0;
        }
        return r;
    }

    public override string ToText()
    {
        var sym = Op switch
        {
            BinaryOp.Topla => " + ",
            BinaryOp.Cikar => " − ",
            BinaryOp.Carp  => " × ",
            BinaryOp.Bol   => " ÷ ",
            _              => " oran ",
        };
        return $"({Left.ToText()}{sym}{Right.ToText()})";
    }

    public override FormulaNode Clone() => new BinaryNode(Op, Left.Clone(), Right.Clone());
}

// ═══════════════════════════════════════════════════════════════════════════
// Keşfedilen formül
// ═══════════════════════════════════════════════════════════════════════════

/// <summary>
/// Evrimin ürettiği indikatör: bir formül + eşik + yön.
/// Eşik mutlak sayı değil, formülün kendi dağılımındaki YÜZDELİK — böylece
/// farklı fiyat ölçeklerindeki coinlerde aynı anlamı taşır.
/// </summary>
public sealed record DiscoveredFormula(
    string Expression,
    string ExpressionJson,
    double ThresholdQuantile,
    bool GreaterThan)
{
    public string Describe() =>
        $"{Expression} {(GreaterThan ? ">" : "<")} kendi {ThresholdQuantile * 100:0}. yüzdeliği";
}

public record FormulaOutcome(
    DiscoveredFormula Formula,
    decimal TrainPct,
    decimal ValidationPct,
    decimal TestPct,
    decimal BuyHoldPct,
    decimal WinRate,
    int TradeCount,
    int Complexity,
    int SymbolsBeatingBuyHold,
    int SymbolCount);

public interface IFormulaDiscovery
{
    Task<List<FormulaOutcome>> EvolveAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default);
}

// ═══════════════════════════════════════════════════════════════════════════
// Genetik programlama motoru
// ═══════════════════════════════════════════════════════════════════════════

/// <summary>
/// Ham OHLCV'den indikatör formülü evrimleştirir.
///
/// NASIL: Rastgele formül ağaçlarından oluşan bir popülasyon kurulur. Her nesilde
/// iyi performans gösterenler seçilir, çaprazlanır (alt ağaç takası) ve mutasyona
/// uğratılır. Nesiller boyunca formüller iyileşir.
///
/// NEDEN BU KADAR DİKKATLİ OLMAK GEREKİYOR: Genetik programlama, aşırı uyuma
/// EN YATKIN yöntemdir — yeterince denenirse geçmiş veriyi ezberleyen bir formül
/// mutlaka bulunur. Buna karşı üç önlem alınır:
///   1. Veri üçe bölünür; test seti evrime HİÇ girmez.
///   2. Karmaşıklık cezası — aynı performansı veren basit formül tercih edilir.
///   3. Asgari işlem sayısı — birkaç şanslı işlemle öne çıkan formüller elenir.
/// </summary>
public class FormulaDiscovery : IFormulaDiscovery
{
    private const int PopulationSize = 180;
    private const int Generations = 18;
    private const int EliteCount = 12;
    private const int TournamentSize = 5;
    private const int MaxDepth = 4;
    private const int MaxComplexity = 14;
    private const int WarmupBars = 60;
    private const int MinTradesPerSymbol = 4;

    private static readonly int[] Periods = [3, 5, 10, 14, 20, 50];
    private static readonly double[] Quantiles = [0.2, 0.35, 0.5, 0.65, 0.8];

    public async Task<List<FormulaOutcome>> EvolveAsync(
        IReadOnlyDictionary<string, List<CandleInput>> dataBySymbol,
        decimal commissionPct,
        IProgress<int>? progress = null,
        CancellationToken ct = default)
    {
        var symbols = new List<SymbolSeries>();
        foreach (var (name, candles) in dataBySymbol)
        {
            if (candles.Count < WarmupBars + 200) continue;
            symbols.Add(SymbolSeries.Build(name, candles));
        }
        if (symbols.Count == 0) return [];

        var rng = new Random(20261030);   // tekrarlanabilir sonuç
        var fee = (double)commissionPct / 100.0;

        // ── Başlangıç popülasyonu ────────────────────────────────────────────
        var population = new List<Individual>(PopulationSize);
        while (population.Count < PopulationSize)
        {
            var tree = RandomTree(rng, MaxDepth);
            if (tree.Size > MaxComplexity) continue;
            population.Add(new Individual(tree,
                Quantiles[rng.Next(Quantiles.Length)],
                rng.Next(2) == 0));
        }

        var evaluated = new Dictionary<string, double>();

        // ── Nesiller ─────────────────────────────────────────────────────────
        for (var gen = 0; gen < Generations; gen++)
        {
            ct.ThrowIfCancellationRequested();

            foreach (var ind in population)
            {
                var key = ind.Key;
                if (evaluated.TryGetValue(key, out var cached)) { ind.Fitness = cached; continue; }

                ind.Fitness = Fitness(ind, symbols, fee, Segment.Train);
                evaluated[key] = ind.Fitness;
            }

            population.Sort((a, b) => b.Fitness.CompareTo(a.Fitness));
            progress?.Report((int)((gen + 1) * 90.0 / Generations));
            await Task.Yield();

            if (gen == Generations - 1) break;

            // Yeni nesil: elitler + turnuva seçimiyle çaprazlama/mutasyon
            var next = new List<Individual>(PopulationSize);
            next.AddRange(population.Take(EliteCount).Select(i => i.Clone()));

            while (next.Count < PopulationSize)
            {
                var p1 = Tournament(population, rng);
                var p2 = Tournament(population, rng);

                var childTree = rng.NextDouble() < 0.7
                    ? Crossover(p1.Tree, p2.Tree, rng)
                    : p1.Tree.Clone();

                if (rng.NextDouble() < 0.35) childTree = Mutate(childTree, rng);
                if (childTree.Size > MaxComplexity) continue;

                var q = rng.NextDouble() < 0.25
                    ? Quantiles[rng.Next(Quantiles.Length)]
                    : p1.Quantile;
                var gt = rng.NextDouble() < 0.15 ? rng.Next(2) == 0 : p1.GreaterThan;

                next.Add(new Individual(childTree, q, gt));
            }

            population = next;
        }

        // ── Seçim doğrulamada, rapor testte ──────────────────────────────────
        var finalists = population
            .Where(i => i.Fitness > double.MinValue)
            .DistinctBy(i => i.Key)
            .OrderByDescending(i => i.Fitness)
            .Take(60)
            .ToList();

        var outcomes = new List<FormulaOutcome>();
        foreach (var ind in finalists)
        {
            ct.ThrowIfCancellationRequested();
            var o = Evaluate(ind, symbols, fee);
            if (o is not null) outcomes.Add(o);
        }

        progress?.Report(100);

        return [.. outcomes.OrderByDescending(o => o.ValidationPct).Take(25)];
    }

    // ─── Ağaç üretimi ────────────────────────────────────────────────────────

    private static FormulaNode RandomTree(Random rng, int depth)
    {
        if (depth <= 1 || rng.NextDouble() < 0.25) return RandomTerminal(rng);

        var roll = rng.NextDouble();
        if (roll < 0.45)
        {
            var op = (WindowOp)rng.Next(Enum.GetValues<WindowOp>().Length);
            return new WindowNode(op, Periods[rng.Next(Periods.Length)], RandomTree(rng, depth - 1));
        }

        var bop = (BinaryOp)rng.Next(Enum.GetValues<BinaryOp>().Length);
        return new BinaryNode(bop, RandomTree(rng, depth - 1), RandomTree(rng, depth - 1));
    }

    private static FormulaNode RandomTerminal(Random rng)
    {
        // Sabitler nadir tutulur: formülün fiyat ilişkilerinden doğmasını isteriz
        if (rng.NextDouble() < 0.12)
            return new ConstNode(Math.Round(rng.NextDouble() * 4 - 1, 2));
        return new PriceNode((PriceField)rng.Next(Enum.GetValues<PriceField>().Length));
    }

    private static Individual Tournament(List<Individual> pop, Random rng)
    {
        var best = pop[rng.Next(pop.Count)];
        for (var i = 1; i < TournamentSize; i++)
        {
            var c = pop[rng.Next(pop.Count)];
            if (c.Fitness > best.Fitness) best = c;
        }
        return best;
    }

    private static FormulaNode Crossover(FormulaNode a, FormulaNode b, Random rng)
    {
        var clone = a.Clone();
        var nodes = Collect(clone);
        var donor = Collect(b);
        if (nodes.Count == 0 || donor.Count == 0) return clone;

        var target = nodes[rng.Next(nodes.Count)];
        var replacement = donor[rng.Next(donor.Count)].Clone();
        return Replace(clone, target, replacement);
    }

    private static FormulaNode Mutate(FormulaNode tree, Random rng)
    {
        var clone = tree.Clone();
        var nodes = Collect(clone);
        if (nodes.Count == 0) return clone;
        var target = nodes[rng.Next(nodes.Count)];
        return Replace(clone, target, RandomTree(rng, 2));
    }

    private static List<FormulaNode> Collect(FormulaNode root)
    {
        var list = new List<FormulaNode>();
        void Walk(FormulaNode n)
        {
            list.Add(n);
            if (n is WindowNode w) Walk(w.Child);
            else if (n is BinaryNode b) { Walk(b.Left); Walk(b.Right); }
        }
        Walk(root);
        return list;
    }

    private static FormulaNode Replace(FormulaNode root, FormulaNode target, FormulaNode replacement)
    {
        if (ReferenceEquals(root, target)) return replacement;

        switch (root)
        {
            case WindowNode w:
                if (ReferenceEquals(w.Child, target)) w.Child = replacement;
                else Replace(w.Child, target, replacement);
                break;
            case BinaryNode b:
                if (ReferenceEquals(b.Left, target)) b.Left = replacement;
                else if (ReferenceEquals(b.Right, target)) b.Right = replacement;
                else { Replace(b.Left, target, replacement); Replace(b.Right, target, replacement); }
                break;
        }
        return root;
    }

    // ─── Uygunluk ve değerlendirme ───────────────────────────────────────────

    private enum Segment { Train, Validation, Test }

    private static double Fitness(Individual ind, List<SymbolSeries> symbols, double fee, Segment seg)
    {
        double edgeSum = 0;
        int trades = 0, used = 0;

        foreach (var s in symbols)
        {
            var r = Simulate(ind, s, seg, fee);
            if (r is null) continue;
            edgeSum += r.Value.strat - r.Value.hold;
            trades += r.Value.trades;
            used++;
        }

        if (used == 0 || trades < used * MinTradesPerSymbol) return double.MinValue;

        var edge = edgeSum / used;

        // Karmaşıklık cezası: aynı sonucu veren basit formül tercih edilir.
        // Karmaşık formüller geçmişi ezberlemeye daha yatkındır.
        var penalty = ind.Tree.Size * 0.15;
        return edge - penalty;
    }

    private static FormulaOutcome? Evaluate(Individual ind, List<SymbolSeries> symbols, double fee)
    {
        double trainSum = 0, valSum = 0, testSum = 0, holdSum = 0, winSum = 0;
        int trades = 0, used = 0, beating = 0;

        foreach (var s in symbols)
        {
            var tr = Simulate(ind, s, Segment.Train, fee);
            var va = Simulate(ind, s, Segment.Validation, fee);
            var te = Simulate(ind, s, Segment.Test, fee);
            if (tr is null || va is null || te is null) continue;

            trainSum += tr.Value.strat - tr.Value.hold;
            valSum   += va.Value.strat - va.Value.hold;
            testSum  += te.Value.strat - te.Value.hold;
            holdSum  += te.Value.hold;

            var t = tr.Value.trades + va.Value.trades + te.Value.trades;
            var w = tr.Value.wins + va.Value.wins + te.Value.wins;
            trades += t;
            if (t > 0) winSum += w * 100.0 / t;

            if (te.Value.strat > te.Value.hold) beating++;
            used++;
        }

        if (used == 0 || trades < used * MinTradesPerSymbol) return null;

        var formula = new DiscoveredFormula(
            ind.Tree.ToText(),
            SerializeTree(ind.Tree),
            ind.Quantile,
            ind.GreaterThan);

        return new FormulaOutcome(
            formula,
            (decimal)Math.Round(trainSum / used, 2),
            (decimal)Math.Round(valSum / used, 2),
            (decimal)Math.Round(testSum / used, 2),
            (decimal)Math.Round(holdSum / used, 2),
            (decimal)Math.Round(winSum / used, 1),
            trades,
            ind.Tree.Size,
            beating,
            used);
    }

    /// <summary>
    /// Formül eşiği aşarken pozisyonda kal. Eşik, formülün EĞİTİM bölümündeki
    /// dağılımından alınır — test verisinden eşik türetmek sızıntı olurdu.
    /// Giriş/çıkış bir sonraki barın açılışından yapılır.
    /// </summary>
    private static (double strat, double hold, int trades, int wins)? Simulate(
        Individual ind, SymbolSeries s, Segment seg, double fee)
    {
        var values = s.GetValues(ind);
        if (values is null) return null;

        var threshold = s.GetThreshold(ind, values);
        if (double.IsNaN(threshold)) return null;

        var (from, to) = s.Range(seg);
        if (to - from < 40) return null;

        double equity = 100;
        double? entry = null;
        int trades = 0, wins = 0;

        for (var i = from; i < to - 1; i++)
        {
            var v = values[i];
            var hold = ind.GreaterThan ? v > threshold : v < threshold;

            if (entry is null && hold) entry = s.Series.Open[i + 1];
            else if (entry is not null && !hold)
            {
                var factor = 1 + (s.Series.Open[i + 1] - entry.Value) / entry.Value - fee;
                equity *= factor;
                trades++;
                if (factor > 1) wins++;
                entry = null;
            }
        }

        if (entry is not null)
        {
            var factor = 1 + (s.Series.Close[to - 1] - entry.Value) / entry.Value - fee;
            equity *= factor;
            trades++;
            if (factor > 1) wins++;
        }

        var start = s.Series.Close[from];
        var holdPct = start > 0 ? (s.Series.Close[to - 1] - start) / start * 100 : 0;

        return (equity - 100, holdPct, trades, wins);
    }

    // ─── Serileştirme (indikatör olarak kaydetmek için) ──────────────────────

    public static string SerializeTree(FormulaNode n) => JsonSerializer.Serialize(ToDto(n));

    public static FormulaNode? DeserializeTree(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var dto = JsonSerializer.Deserialize<NodeDto>(json);
            return dto is null ? null : FromDto(dto);
        }
        catch (JsonException) { return null; }
    }

    public record NodeDto(string Kind, int? Field, double? Value, int? Op, int? Period, NodeDto? A, NodeDto? B);

    private static NodeDto ToDto(FormulaNode n) => n switch
    {
        PriceNode p  => new NodeDto("price", (int)p.Field, null, null, null, null, null),
        ConstNode c  => new NodeDto("const", null, c.Value, null, null, null, null),
        WindowNode w => new NodeDto("win", null, null, (int)w.Op, w.Period, ToDto(w.Child), null),
        BinaryNode b => new NodeDto("bin", null, null, (int)b.Op, null, ToDto(b.Left), ToDto(b.Right)),
        _            => throw new InvalidOperationException("Bilinmeyen düğüm tipi"),
    };

    private static FormulaNode FromDto(NodeDto d) => d.Kind switch
    {
        "price" => new PriceNode((PriceField)(d.Field ?? 3)),
        "const" => new ConstNode(d.Value ?? 0),
        "win"   => new WindowNode((WindowOp)(d.Op ?? 0), d.Period ?? 14, FromDto(d.A!)),
        "bin"   => new BinaryNode((BinaryOp)(d.Op ?? 0), FromDto(d.A!), FromDto(d.B!)),
        _       => new PriceNode(PriceField.Close),
    };

    // ─── Yardımcı tipler ─────────────────────────────────────────────────────

    private sealed class Individual(FormulaNode tree, double quantile, bool greaterThan)
    {
        public FormulaNode Tree { get; } = tree;
        public double Quantile { get; } = quantile;
        public bool GreaterThan { get; } = greaterThan;
        public double Fitness { get; set; } = double.MinValue;

        public string Key => $"{Tree.ToText()}|{Quantile:0.00}|{GreaterThan}";
        public Individual Clone() => new(Tree.Clone(), Quantile, GreaterThan) { Fitness = Fitness };
    }

    private sealed class SymbolSeries
    {
        public required string Name { get; init; }
        public required PriceSeries Series { get; init; }
        public int TrainEnd { get; private set; }
        public int ValidationEnd { get; private set; }

        // Aynı formül birçok birey tarafından paylaşılır; seri bir kez hesaplanır.
        private readonly Dictionary<string, double[]> _valueCache = [];
        private readonly Dictionary<string, double> _thresholdCache = [];

        public static SymbolSeries Build(string name, List<CandleInput> candles)
        {
            var s = new SymbolSeries { Name = name, Series = PriceSeries.From(candles) };
            var usable = candles.Count - WarmupBars;
            s.TrainEnd = WarmupBars + (int)(usable * 0.50);
            s.ValidationEnd = WarmupBars + (int)(usable * 0.75);
            return s;
        }

        public (int from, int to) Range(Segment seg) => seg switch
        {
            Segment.Train      => (WarmupBars, TrainEnd),
            Segment.Validation => (TrainEnd, ValidationEnd),
            _                  => (ValidationEnd, Series.Length),
        };

        public double[]? GetValues(Individual ind)
        {
            var key = ind.Tree.ToText();
            if (_valueCache.TryGetValue(key, out var cached)) return cached;

            if (_valueCache.Count > 4000) _valueCache.Clear();   // bellek sınırı

            var v = ind.Tree.Evaluate(Series);
            _valueCache[key] = v;
            return v;
        }

        public double GetThreshold(Individual ind, double[] values)
        {
            var key = $"{ind.Tree.ToText()}|{ind.Quantile:0.00}";
            if (_thresholdCache.TryGetValue(key, out var cached)) return cached;

            // Eşik YALNIZCA eğitim bölümünden — doğrulama/test sızıntısı olmaz
            var sample = new List<double>(TrainEnd - WarmupBars);
            for (var i = WarmupBars; i < TrainEnd; i++)
            {
                var v = values[i];
                if (!double.IsNaN(v) && !double.IsInfinity(v)) sample.Add(v);
            }

            if (sample.Count < 30) return double.NaN;
            sample.Sort();

            var idx = Math.Clamp((int)(sample.Count * ind.Quantile), 0, sample.Count - 1);
            var th = sample[idx];

            // Neredeyse sabit formüller elenir. Örneğin uzun pencereli bir "en yüksek"
            // işlemi değeri doygunlaştırıp sabit hale getirebilir; böyle bir formül
            // geçmişte iyi görünse bile sinyal üretmez, bilgi taşımaz.
            // Ölçü: çeyrekler arası yayılım, büyüklüğüne göre anlamlı olmalı.
            var q1 = sample[sample.Count / 4];
            var q3 = sample[sample.Count * 3 / 4];
            var spread = q3 - q1;
            var magnitude = Math.Max(Math.Abs(th), 1e-6);

            if (spread / magnitude < 0.002) return double.NaN;

            if (_thresholdCache.Count > 8000) _thresholdCache.Clear();
            _thresholdCache[key] = th;
            return th;
        }
    }
}
