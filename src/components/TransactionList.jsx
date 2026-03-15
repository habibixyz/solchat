export default function TransactionList({ txs = [] }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg mb-4">Recent Transactions</h2>
      <table className="w-full text-sm">
        <thead className="text-slate-400 border-b border-slate-800">
          <tr>
            <th>Wallet</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {txs.slice(0, 20).map((tx, i) => (
            <tr key={i} className="border-b border-slate-800">
              <td>{tx.owner}</td>
              <td>{tx.side}</td>
              <td>{tx.amount}</td>
              <td>{new Date(tx.blockTime * 1000).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}