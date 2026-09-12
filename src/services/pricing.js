// Platform commission — the truck owner is shown/paid the requirement's budget
// minus a slice that scales down as the load gets bigger.
//   budget <= 10,000        -> 20% cut
//   10,000 < budget <= 20,000 -> 15% cut
//   budget > 20,000         -> 10% cut
function commissionPercentFor(budget) {
  const amt = Number(budget) || 0;
  if (amt <= 10000) return 20;
  if (amt <= 20000) return 15;
  return 10;
}

function computeOwnerPayout(budget) {
  const amt = Number(budget) || 0;
  const commissionPercent = commissionPercentFor(amt);
  const commissionAmount = Math.round((amt * commissionPercent) / 100);
  const ownerPayout = amt - commissionAmount;
  return { ownerPayout, commissionPercent, commissionAmount };
}

module.exports = { commissionPercentFor, computeOwnerPayout };
