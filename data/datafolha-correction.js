// Frozen research export from datafolha-2026-combined-adjustment.json.
// Not a residual institute effect, pooled polling estimate or forecast.
export const datafolhaSeptember10={
  id:'2026-09-10',
  registration:'BR-01833/2026',
  disclosureGrade:'A',
  published:{lula:46,flavio:44,other:10},
  adjusted:{lula:44.8117044181,flavio:45.9081843677,other:9.2801112142},
  variableDecomposition:{
    method:'Shapley allocation across all 120 variable orderings',
    contributionsPercentagePoints:{
      sex:{lula:0.0712975811,flavio:-0.0904173434,other:0.0191197623},
      age:{lula:-0.0903653052,flavio:0.0491553107,other:0.0412099944},
      education:{lula:0.8506726413,flavio:-0.794421338,other:-0.0562513033},
      income:{lula:-2.0904366333,flavio:2.8068825801,other:-0.7164459469},
      region:{lula:0.0705361342,flavio:-0.0630148419,other:-0.0075212924}
    },
    totalCorrection:{lula:-1.1882955819,flavio:1.9081843677,other:-0.7198887858}
  },
  evidenceGate:{pollsReviewed:85,institutes:20,fullPublicTableEstimates:7,modelAssistedEstimates:3,notEstimable:75},
  generatedOn:'2026-09-20'
};
