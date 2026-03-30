import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function Chart() {

  const chartRef = useRef();

  useEffect(() => {

    const chart = createChart(chartRef.current, {
      height: 400,
      layout: {
        background: { color: "#020617" },
        textColor: "#94a3b8"
      }
    });

    const lineSeries = chart.addLineSeries();

    lineSeries.setData([
      { time: "2024-01-01", value: 0.01 },
      { time: "2024-01-02", value: 0.015 },
      { time: "2024-01-03", value: 0.012 }
    ]);

  }, []);

  return <div ref={chartRef} className="mt-6" />;
}
