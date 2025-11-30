'use client';

import React, { useState, useMemo } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { Switch } from "@/components/ai/ui/switch";
import benchmarkResults from "@/scripts/benchmark_results.json";

type BenchmarkResult = typeof benchmarkResults[0];
type Scenario = 'small' | 'medium' | 'big';
type SortField = 'provider' | 'model' | 'smallTokens' | 'smallDuration' | 'smallCost' | 'mediumTokens' | 'mediumDuration' | 'mediumCost' | 'worseTokens' | 'worseDuration' | 'worseCost' | 'premium';
type SortDirection = 'asc' | 'desc';
type Currency = 'USD' | 'MXN';

export function BenchmarksTable() {
  const [sortField, setSortField] = useState<SortField>('provider');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [premiumModel, setPremiumModel] = useState<string>('average');
  const [nonPremiumModel, setNonPremiumModel] = useState<string>('average');
  const [premiumMultiplier, setPremiumMultiplier] = useState<number>(100);
  const [nonPremiumMultiplier, setNonPremiumMultiplier] = useState<number>(1000);
  const [customScenario, setCustomScenario] = useState<Scenario | 'average'>('small');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(18.5);

  // Calculate raw cost without multipliers (for statistics)
  const calculateRawCost = (result: BenchmarkResult, scenario: Scenario) => {
    const scenarioData = result[scenario];
    if (!scenarioData || 'error' in scenarioData) {
      return 0;
    }
    const costStr = scenarioData.totalCost;
    if (!costStr || typeof costStr !== 'string') {
      return 0;
    }
    const cost = parseFloat(costStr);
    if (isNaN(cost)) {
      return 0;
    }
    return cost;
  };

  const calculateDisplayCost = (result: BenchmarkResult, scenario: Scenario) => {
    const scenarioData = result[scenario];
    if (!scenarioData || 'error' in scenarioData) {
      return 0;
    }
    const costStr = scenarioData.totalCost;
    if (!costStr || typeof costStr !== 'string') {
      return 0;
    }
    const cost = parseFloat(costStr);
    if (isNaN(cost)) {
      return 0;
    }
    const multiplier = result.isPremium ? 100 : 1000;
    return cost * multiplier;
  };

  // Convert USD to MXN if needed
  const convertCurrency = (usdAmount: number): number => {
    if (currency === 'MXN') {
      return usdAmount * exchangeRate;
    }
    return usdAmount;
  };

  // Format price according to selected currency
  const formatPrice = (usdAmount: number): string => {
    const amount = convertCurrency(usdAmount);
    const formatter = new Intl.NumberFormat(
      currency === 'MXN' ? 'es-MX' : 'en-US',
      {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    );
    return formatter.format(amount);
  };

  const getSortValue = (result: BenchmarkResult, field: SortField) => {
    switch (field) {
      case 'provider':
        return result.provider;
      case 'model':
        return result.model;
      case 'smallTokens': {
        const data = result.small;
        return 'error' in data || !data.totalTokens ? 0 : data.totalTokens;
      }
      case 'smallDuration': {
        const data = result.small;
        return 'error' in data || !data.durationSeconds ? 0 : data.durationSeconds;
      }
      case 'smallCost':
        return calculateDisplayCost(result, 'small');
      case 'mediumTokens': {
        const data = result.medium;
        return 'error' in data || !data.totalTokens ? 0 : data.totalTokens;
      }
      case 'mediumDuration': {
        const data = result.medium;
        return 'error' in data || !data.durationSeconds ? 0 : data.durationSeconds;
      }
      case 'mediumCost':
        return calculateDisplayCost(result, 'medium');
      case 'worseTokens': {
        const data = result.big;
        return 'error' in data || !data.totalTokens ? 0 : data.totalTokens;
      }
      case 'worseDuration': {
        const data = result.big;
        return 'error' in data || !data.durationSeconds ? 0 : data.durationSeconds;
      }
      case 'worseCost':
        return calculateDisplayCost(result, 'big');
      case 'premium':
        return result.isPremium ? 1 : 0;
      default:
        return '';
    }
  };

  const sortedResults = useMemo(() => {
    const sorted = [...benchmarkResults].sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [sortField, sortDirection]);

  const statistics = useMemo(() => {
    const premiumModels = benchmarkResults.filter(r => r.isPremium);
    const nonPremiumModels = benchmarkResults.filter(r => !r.isPremium);

    // Use raw costs (no multipliers) for statistics
    const calculateAverage = (models: BenchmarkResult[], scenario: Scenario) => {
      const costs = models
        .map(r => calculateRawCost(r, scenario))
        .filter(cost => cost > 0);
      return costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0;
    };

    const calculateOverallAverage = (models: BenchmarkResult[]) => {
      const allCosts: number[] = [];
      (['small', 'medium', 'big'] as Scenario[]).forEach(scenario => {
        models.forEach(r => {
          const cost = calculateRawCost(r, scenario);
          if (cost > 0) allCosts.push(cost);
        });
      });
      return allCosts.length > 0 ? allCosts.reduce((sum, cost) => sum + cost, 0) / allCosts.length : 0;
    };

    return {
      premium: {
        overall: calculateOverallAverage(premiumModels),
        small: calculateAverage(premiumModels, 'small'),
        medium: calculateAverage(premiumModels, 'medium'),
        worse: calculateAverage(premiumModels, 'big'),
      },
      nonPremium: {
        overall: calculateOverallAverage(nonPremiumModels),
        small: calculateAverage(nonPremiumModels, 'small'),
        medium: calculateAverage(nonPremiumModels, 'medium'),
        worse: calculateAverage(nonPremiumModels, 'big'),
      },
    };
  }, []);

  const customScenarioCost = useMemo(() => {
    const calculateCustomCost = (modelId: string, isPremium: boolean, multiplier: number) => {
      if (modelId === 'average') {
        // Get the average cost for the selected scenario (raw costs without multipliers)
        let avg: number;
        if (customScenario === 'average') {
          // Average across all three scenarios
          const overall = isPremium ? statistics.premium.overall : statistics.nonPremium.overall;
          // Statistics contain raw costs, so multiply directly by user's multiplier
          return overall * multiplier;
        } else {
          avg = isPremium 
            ? statistics.premium[customScenario === 'small' ? 'small' : customScenario === 'medium' ? 'medium' : 'worse']
            : statistics.nonPremium[customScenario === 'small' ? 'small' : customScenario === 'medium' ? 'medium' : 'worse'];
          // Statistics contain raw costs, so multiply directly by user's multiplier
          return avg * multiplier;
        }
      }
      
      const model = benchmarkResults.find(r => r.model === modelId);
      if (!model) return 0;
      
      if (customScenario === 'average') {
        // Calculate average across all three scenarios for this specific model
        const scenarios: Scenario[] = ['small', 'medium', 'big'];
        const costs: number[] = [];
        
        scenarios.forEach(scenario => {
          const scenarioData = model[scenario];
          if (scenarioData && !('error' in scenarioData) && scenarioData.totalCost) {
            const costStr = scenarioData.totalCost;
            if (costStr && typeof costStr === 'string') {
              const baseCost = parseFloat(costStr);
              if (!isNaN(baseCost)) {
                costs.push(baseCost);
              }
            }
          }
        });
        
        if (costs.length === 0) return 0;
        const avgBaseCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
        return avgBaseCost * multiplier;
      }
      
      const scenarioData = model[customScenario];
      if (!scenarioData || 'error' in scenarioData) return 0;
      
      const costStr = scenarioData.totalCost;
      if (!costStr || typeof costStr !== 'string') return 0;
      
      const baseCost = parseFloat(costStr);
      if (isNaN(baseCost)) return 0;
      
      return baseCost * multiplier;
    };

    const premiumCost = calculateCustomCost(premiumModel, true, premiumMultiplier);
    const nonPremiumCost = calculateCustomCost(nonPremiumModel, false, nonPremiumMultiplier);
    
    return {
      premium: premiumCost,
      nonPremium: nonPremiumCost,
      total: premiumCost + nonPremiumCost,
    };
  }, [premiumModel, nonPremiumModel, premiumMultiplier, nonPremiumMultiplier, customScenario, statistics]);

  const misclassifiedModels = useMemo(() => {
    const misclassified: Array<{
      model: BenchmarkResult;
      currentCategory: 'premium' | 'non-premium';
      suggestedCategory: 'premium' | 'non-premium';
      currentCost: number;
      alternativeCost: number;
      reason: string;
    }> = [];

    benchmarkResults.forEach((model) => {
      const worseData = model.big;
      if (!worseData || 'error' in worseData || !worseData.totalCost) return;

      const baseCost = parseFloat(worseData.totalCost);
      if (isNaN(baseCost)) return;

      if (model.isPremium) {
        // Premium model: check if it would be < 6 as non-premium
        const nonPremiumCost = baseCost * 1000;
        if (nonPremiumCost < 6) {
          misclassified.push({
            model,
            currentCategory: 'premium',
            suggestedCategory: 'non-premium',
            currentCost: baseCost * 100,
            alternativeCost: nonPremiumCost,
            reason: `Too cheap as premium (would be ${formatPrice(nonPremiumCost)} as non-premium)`,
          });
        }
      } else {
        // Non-premium model: check if it's too expensive
        const nonPremiumCost = baseCost * 1000;
        const premiumCost = baseCost * 100;
        
        // Check if it's already too expensive as non-premium (> $6)
        if (nonPremiumCost > 6) {
          misclassified.push({
            model,
            currentCategory: 'non-premium',
            suggestedCategory: 'premium',
            currentCost: nonPremiumCost,
            alternativeCost: premiumCost,
            reason: `Too expensive as non-premium (current: ${formatPrice(nonPremiumCost)}, would be ${formatPrice(premiumCost)} as premium)`,
          });
        }
      }
    });

    return misclassified;
  }, [currency, exchangeRate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpIcon className="w-3 h-3 opacity-30" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUpIcon className="w-3 h-3" />
      : <ArrowDownIcon className="w-3 h-3" />;
  };

  const SortableHeader = ({ field, children, className = '', align = 'right' }: { field: SortField; children: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) => (
    <th 
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:bg-muted/70 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  const renderScenarioCell = (result: BenchmarkResult, scenario: Scenario, type: 'tokens' | 'duration' | 'cost') => {
    const scenarioData = result[scenario];
    const hasError = !scenarioData || 'error' in scenarioData;

    if (type === 'tokens') {
      return (
        <td className="px-4 py-3 text-right font-mono text-xs">
          {hasError ? 'N/A' : scenarioData.totalTokens?.toLocaleString() ?? 'N/A'}
        </td>
      );
    }
    if (type === 'duration') {
      return (
        <td className="px-4 py-3 text-right font-mono text-xs">
          {hasError ? 'N/A' : scenarioData.durationSeconds?.toFixed(2) ?? 'N/A'}s
        </td>
      );
    }
    const cost = calculateDisplayCost(result, scenario);
    return (
      <td className="px-4 py-3 text-right font-mono font-medium text-xs">
        {formatPrice(cost)}
      </td>
    );
  };

  return (
    <div className="space-y-4">
      {/* Currency Toggle and Exchange Rate */}
      <div className="flex items-center justify-end gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label htmlFor="currency-toggle" className="text-sm font-medium text-muted-foreground">
            Currency:
          </label>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${currency === 'USD' ? 'font-semibold' : 'text-muted-foreground'}`}>
              USD
            </span>
            <Switch
              id="currency-toggle"
              checked={currency === 'MXN'}
              onCheckedChange={(checked) => setCurrency(checked ? 'MXN' : 'USD')}
            />
            <span className={`text-sm ${currency === 'MXN' ? 'font-semibold' : 'text-muted-foreground'}`}>
              MXN
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="exchange-rate" className="text-sm font-medium text-muted-foreground">
            Exchange Rate (USD → MXN):
          </label>
          <input
            id="exchange-rate"
            type="number"
            value={exchangeRate}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value > 0) {
                setExchangeRate(value);
              }
            }}
            min="0.01"
            step="0.1"
            className="w-20 px-2 py-1 text-sm border border-border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>
      {/* Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Premium Models Statistics */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-600 dark:text-blue-400">
            Premium Models - Average
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Overall Average:</span>
              <span className="font-mono font-semibold">{formatPrice(statistics.premium.overall * 100)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Light:</span>
              <span className="font-mono">{formatPrice(statistics.premium.small * 100)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Standard:</span>
              <span className="font-mono">{formatPrice(statistics.premium.medium * 100)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Worse:</span>
              <span className="font-mono">{formatPrice(statistics.premium.worse * 100)}</span>
            </div>
          </div>
        </div>

        {/* Non-Premium Models Statistics */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-600 dark:text-gray-400">
            Non-Premium Models - Average
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Overall Average:</span>
              <span className="font-mono font-semibold">{formatPrice(statistics.nonPremium.overall * 1000)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Light:</span>
              <span className="font-mono">{formatPrice(statistics.nonPremium.small * 1000)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Standard:</span>
              <span className="font-mono">{formatPrice(statistics.nonPremium.medium * 1000)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Worse:</span>
              <span className="font-mono">{formatPrice(statistics.nonPremium.worse * 1000)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scenario Section */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h3 className="text-lg font-semibold mb-6">Custom Scenario</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Premium Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Premium Model</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Select Model</label>
                <select
                  value={premiumModel}
                  onChange={(e) => setPremiumModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="average">Average</option>
                  {benchmarkResults
                    .filter(r => r.isPremium)
                    .map((result) => (
                      <option key={result.model} value={result.model}>
                        {result.model}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Multiplier</label>
                <input
                  type="number"
                  value={premiumMultiplier}
                  onChange={(e) => setPremiumMultiplier(Number(e.target.value))}
                  min="1"
                  step="1"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Non-Premium Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Non-Premium Model</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Select Model</label>
                <select
                  value={nonPremiumModel}
                  onChange={(e) => setNonPremiumModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="average">Average</option>
                  {benchmarkResults
                    .filter(r => !r.isPremium)
                    .map((result) => (
                      <option key={result.model} value={result.model}>
                        {result.model}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Multiplier</label>
                <input
                  type="number"
                  value={nonPremiumMultiplier}
                  onChange={(e) => setNonPremiumMultiplier(Number(e.target.value))}
                  min="1"
                  step="1"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scenario Selection */}
        <div className="mb-6">
          <label className="block text-xs text-muted-foreground mb-1.5">Scenario</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCustomScenario('small')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                customScenario === 'small'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setCustomScenario('medium')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                customScenario === 'medium'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setCustomScenario('big')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                customScenario === 'big'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              Worse
            </button>
            <button
              onClick={() => setCustomScenario('average')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                customScenario === 'average'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              Average
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="border-t border-border pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Premium Cost</div>
              <div className="text-xl font-mono font-semibold text-blue-600 dark:text-blue-400">
                {formatPrice(customScenarioCost.premium)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Non-Premium Cost</div>
              <div className="text-xl font-mono font-semibold text-gray-600 dark:text-gray-400">
                {formatPrice(customScenarioCost.nonPremium)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
              <div className="text-2xl font-mono font-bold">
                {formatPrice(customScenarioCost.total)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm text-left min-w-[1400px]">
          <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
            <tr>
              <SortableHeader field="provider" className="text-left sticky left-0 bg-muted/50 z-10 border-r border-border" align="left">
                <span>Provider</span>
              </SortableHeader>
              <SortableHeader field="model" className="text-left sticky left-32 bg-muted/50 z-10 border-r border-border" align="left">
                <span>Model</span>
              </SortableHeader>
              
              {/* Light Scenario */}
              <th colSpan={3} className="px-4 py-3 text-center font-semibold border-l border-r border-border">
                Light
              </th>
              
              {/* Standard Scenario */}
              <th colSpan={3} className="px-4 py-3 text-center font-semibold border-r border-border">
                Standard
              </th>
              
              {/* Worse (Big) Scenario */}
              <th colSpan={3} className="px-4 py-3 text-center font-semibold border-r border-border">
                Worse
              </th>
              
              <SortableHeader field="premium" align="center">
                <span>Premium</span>
              </SortableHeader>
            </tr>
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
              
              {/* Light columns */}
              <SortableHeader field="smallTokens">
                <span>Tokens</span>
              </SortableHeader>
              <SortableHeader field="smallDuration">
                <span>Duration</span>
              </SortableHeader>
              <SortableHeader field="smallCost">
                <span>Cost</span>
              </SortableHeader>
              
              {/* Standard columns */}
              <SortableHeader field="mediumTokens">
                <span>Tokens</span>
              </SortableHeader>
              <SortableHeader field="mediumDuration">
                <span>Duration</span>
              </SortableHeader>
              <SortableHeader field="mediumCost">
                <span>Cost</span>
              </SortableHeader>
              
              {/* Worse columns */}
              <SortableHeader field="worseTokens">
                <span>Tokens</span>
              </SortableHeader>
              <SortableHeader field="worseDuration">
                <span>Duration</span>
              </SortableHeader>
              <SortableHeader field="worseCost">
                <span>Cost</span>
              </SortableHeader>
              
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedResults.map((result, index) => (
              <tr key={index} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-medium capitalize sticky left-0 bg-card z-10 border-r border-border">
                  {result.provider}
                </td>
                <td className="px-4 py-3 sticky left-32 bg-card z-10 border-r border-border">
                  {result.model}
                </td>
                
                {/* Light scenario */}
                {renderScenarioCell(result, 'small', 'tokens')}
                {renderScenarioCell(result, 'small', 'duration')}
                {renderScenarioCell(result, 'small', 'cost')}
                
                {/* Standard scenario */}
                {renderScenarioCell(result, 'medium', 'tokens')}
                {renderScenarioCell(result, 'medium', 'duration')}
                {renderScenarioCell(result, 'medium', 'cost')}
                
                {/* Worse (Big) scenario */}
                {renderScenarioCell(result, 'big', 'tokens')}
                {renderScenarioCell(result, 'big', 'duration')}
                {renderScenarioCell(result, 'big', 'cost')}
                
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    result.isPremium 
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  }`}>
                    {result.isPremium ? "Premium" : "Standard"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Misclassification Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Potential Misclassified Models (Worse Scenario)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Models that may need category adjustment based on pricing thresholds ($6 threshold).
        </p>
        {misclassifiedModels.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium text-left">Provider</th>
                  <th className="px-4 py-3 font-medium text-left">Model</th>
                  <th className="px-4 py-3 font-medium text-center">Current Category</th>
                  <th className="px-4 py-3 font-medium text-right">Current Cost</th>
                  <th className="px-4 py-3 font-medium text-center">Suggested Category</th>
                  <th className="px-4 py-3 font-medium text-right">Alternative Cost</th>
                  <th className="px-4 py-3 font-medium text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {misclassifiedModels.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium capitalize">
                      {item.model.provider}
                    </td>
                    <td className="px-4 py-3">
                      {item.model.model}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.currentCategory === 'premium'
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                      }`}>
                        {item.currentCategory === 'premium' ? 'Premium' : 'Non-Premium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(item.currentCost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.suggestedCategory === 'premium'
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }`}>
                        {item.suggestedCategory === 'premium' ? 'Premium' : 'Non-Premium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(item.alternativeCost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No misclassified models found. All models are correctly categorized based on the $6 threshold.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

