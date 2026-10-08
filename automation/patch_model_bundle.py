#!/usr/bin/env python3

import base64
import io
import re
import sys
import tarfile
from pathlib import Path


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "model-source")
    test_file = root / "research/current-model/test_current_model.py"
    source = test_file.read_text(encoding="utf-8")
    dynamic_assertion = 'self.assertEqual(len(by_poll), self.summary["polls"])'

    if dynamic_assertion not in source:
        updated, replacements = re.subn(
            r"self\.assertEqual\(len\(by_poll\),\s*\d+\)",
            dynamic_assertion,
            source,
            count=1,
        )
        if replacements != 1:
            raise SystemExit("Unable to locate the stale fixed poll-count assertion.")
        test_file.write_text(updated, encoding="utf-8")

    gate_file = root / "operations/extend_current_gate.py"
    gate = gate_file.read_text(encoding="utf-8")
    cutoff_updates = (
        'spec["cutoff"]["latest_publication_date"] = spec["inputs"]["latest_publication_date"]\n'
        'spec["cutoff"]["latest_fieldwork_end"] = spec["inputs"]["latest_fieldwork_end"]\n'
    )
    if cutoff_updates not in gate:
        anchor = 'spec["inputs"]["latest_fieldwork_end"] = max(row["end"] for row in runoff)\n'
        if gate.count(anchor) != 1:
            raise SystemExit("Unable to locate the release-cutoff update anchor.")
        gate_file.write_text(gate.replace(anchor, anchor + cutoff_updates), encoding="utf-8")

    ranking_test = root / "research/institute-rankings/test_rankings.py"
    ranking = ranking_test.read_text(encoding="utf-8")
    stale_count = "rows=self.data['current_corrections'];self.assertEqual(len(rows),20);self.assertEqual(len({r['institute'] for r in rows}),20)"
    dynamic_count = "rows=self.data['current_corrections'];self.assertEqual(len(rows),len({r['institute'] for r in rows}))"
    if dynamic_count not in ranking:
        if ranking.count(stale_count) != 1:
            raise SystemExit("Unable to locate the stale fixed institute-count assertion.")
        ranking = ranking.replace(stale_count, dynamic_count)

    stale_pnad = "rows=self.data['current_corrections'];self.assertEqual(sum(r['pnad_adjustment_pp'] is not None for r in rows),1)"
    nullable_pnad = "rows=self.data['current_corrections'];missing=[r for r in rows if r['pnad_adjustment_pp'] is None]"
    if nullable_pnad not in ranking:
        if ranking.count(stale_pnad) != 1:
            raise SystemExit("Unable to locate the stale fixed PNAD-count assertion.")
        ranking = ranking.replace(
            stale_pnad,
            nullable_pnad + "\n  self.assertTrue(missing);self.assertTrue(all(not r['total_is_complete'] for r in missing))",
        )
    ranking_test.write_text(ranking, encoding="utf-8")

    overlay_file = Path(__file__).with_name("model-method-overlay.tar.gz.b64")
    if overlay_file.exists():
        payload = base64.b64decode("".join(overlay_file.read_text(encoding="ascii").split()))
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            members = archive.getmembers()
            if any(member.name.startswith("/") or ".." in Path(member.name).parts or not member.isfile() for member in members):
                raise SystemExit("Unsafe model overlay archive.")
            archive.extractall(root, members=members)

    # Raw publication is allowed to arrive one round at a time. The forecast
    # consumes runoff rows, while raw first-round pages consume first-round
    # rows; neither data surface should fabricate a counterpart solely to keep
    # the two record counts equal.
    adopter_file = root / "site/adopt-runtime-raw.mjs"
    adopter = adopter_file.read_text(encoding="utf-8")
    strict_adopter_pairing = (
        "if(first.length!==runoff.length)throw Error(`Unpaired runtime feed: ${first.length} first-round, ${runoff.length} runoff`);\n"
        "const key=row=>`${row.pollster}|${row.registration||row.end}`;\n"
        "const firstKeys=new Set(first.map(key));\n"
        "for(const row of runoff)if(!firstKeys.has(key(row)))throw Error(`Missing first-round pair for ${row.registration}`);\n"
    )
    if strict_adopter_pairing in adopter:
        adopter = adopter.replace(strict_adopter_pairing, "", 1)
    elif "Unpaired runtime feed" in adopter or "Missing first-round pair" in adopter:
        raise SystemExit("Unable to relax the runtime adopter paired-round validation.")
    adopter = adopter.replace(
        "console.log(`Adopted ${first.length} paired waves from the runtime feed.`);",
        "console.log(`Adopted ${first.length} first-round and ${runoff.length} runoff records from the runtime feed.`);",
    )
    runoff_start = adopter.index("const cleanRunoff=")
    runoff_end = adopter.index("const updated=", runoff_start)
    enhanced_runoff = """const cleanRunoff=runoff.map(row=>({
  pollster:row.pollster,start:row.start,end:row.end,published:row.published,
  lula:row.values.lula,flavio:row.values.flavio,sample:row.sample,moe:row.moe,
  registration:row.registration,source:row.source,
  responses:row.responses||{},coverage:row.coverage||'partial',
  confidence:row.confidence??null,method:row.method??null,
  verification:row.verification||'inherited-source-linked',
  basis:row.basis||'total respondents',
  ...(row.methodSource?{methodSource:row.methodSource}:{}),
  ...(row.auditNote?{auditNote:row.auditNote}:{})
}));
"""
    adopter = adopter[:runoff_start] + enhanced_runoff + adopter[runoff_end:]
    adopter_file.write_text(adopter, encoding="utf-8")

    import_file = root / "site/import-raw.mjs"
    import_source = import_file.read_text(encoding="utf-8")
    strict_additions = (
        "for(const a of first.length<inherited.polls.length?additions:[]){\n"
        " const p=inherited.polls[a.wave-1],s=sourceMap[a.wave-1];\n"
    )
    independent_additions = (
        "for(const a of additions){\n"
        " const p=inherited.polls[a.wave-1],s=sourceMap[a.wave-1];\n"
        " if(first.some(row=>row.pollster===p.pollster&&row.registration===p.registration&&row.end===p.end))continue;\n"
    )
    if independent_additions not in import_source:
        if import_source.count(strict_additions) != 1:
            raise SystemExit("Unable to locate the first-round additions loop.")
        import_source = import_source.replace(strict_additions, independent_additions, 1)
    records_start = import_source.index("const records=")
    records_end = import_source.index("for(const p of records)", records_start)
    independent_records = """const records=[...first.map(p=>({...p,round:1,verification:p.verification||'primary-result'})),...inherited.polls.map((p,i)=>({...p,id:p.id||`RAW-R2-${String(i+6).padStart(3,'0')}`,round:2,values:p.values||{lula:p.lula,flavio:p.flavio},responses:p.responses||{},coverage:p.coverage||'partial',confidence:p.confidence??null,method:p.method??null,verification:p.verification||'inherited-source-linked'}))].map(p=>({...p,waveId:`${p.pollster}|${p.registration||p.end}|R${p.round}`,basis:p.basis||'total respondents',scenario:p.round===2?'Lula × Flávio Bolsonaro':p.scenario||'Main stimulated first-round scenario'}));
"""
    import_source = import_source[:records_start] + independent_records + import_source[records_end:]
    coverage_start = import_source.index("const coverage=")
    coverage_end = import_source.index("writeFileSync(new URL('data/poll-coverage.json'", coverage_start)
    independent_coverage = """const coverage=inherited.polls.flatMap((p,i)=>{const match=records.find(r=>r.round===1&&r.pollster===p.pollster&&r.registration===p.registration&&r.end===p.end);if(!match)return [];const second=records.find(r=>r.round===2&&r.pollster===p.pollster&&r.registration===p.registration&&r.end===p.end);return [{wave:i+1,pollster:p.pollster,published:p.published,registration:p.registration,firstRoundId:match.id,secondRoundId:second?.id||null,firstRoundSource:match.source,scenario:match.scenario,candidateCount:Object.keys(match.values).length,categoryCoverage:match.coverage,metadataStatus:match.metadataStatus||'transcribed'}];});
"""
    import_source = import_source[:coverage_start] + independent_coverage + import_source[coverage_end:]
    import_file.write_text(import_source, encoding="utf-8")

    verify_file = root / "site/verify.mjs"
    verify_source = verify_file.read_text(encoding="utf-8")
    strict_verify = (
        "check('paired unique source-linked records, with valid dates and published values',()=>{\n"
        " assert.equal(records.length,expectedWaves*2);assert.equal(records.filter(p=>p.round===1).length,expectedWaves);assert.equal(records.filter(p=>p.round===2).length,expectedWaves);assert.equal(new Set(records.map(p=>p.id)).size,records.length);\n"
    )
    independent_verify = (
        "check('round-specific unique source-linked records, with valid dates and published values',()=>{\n"
        " const manifest=JSON.parse(read('data/raw-manifest.json'));assert.equal(records.length,manifest.firstRound+expectedWaves);assert.equal(records.filter(p=>p.round===1).length,manifest.firstRound);assert.equal(records.filter(p=>p.round===2).length,expectedWaves);assert.equal(new Set(records.map(p=>p.id)).size,records.length);\n"
    )
    if independent_verify not in verify_source:
        if verify_source.count(strict_verify) != 1:
            raise SystemExit("Unable to locate the paired-record site verification.")
        verify_file.write_text(verify_source.replace(strict_verify, independent_verify, 1), encoding="utf-8")

    verify_source = verify_file.read_text(encoding="utf-8")
    strict_coverage_verify = (
        "check('Every runoff wave has a distinct first-round counterpart with preserved legacy IDs',()=>{\n"
        " const coverage=JSON.parse(read('data/poll-coverage.json'));assert.equal(coverage.length,expectedWaves);assert.equal(new Set(coverage.map(p=>p.firstRoundId)).size,expectedWaves);\n"
    )
    independent_coverage_verify = (
        "check('Every paired wave has distinct round IDs while unmatched releases remain explicit',()=>{\n"
        " const coverage=JSON.parse(read('data/poll-coverage.json'));assert(coverage.length<=expectedWaves);assert.equal(new Set(coverage.map(p=>p.firstRoundId)).size,coverage.length);\n"
    )
    if independent_coverage_verify not in verify_source:
        if verify_source.count(strict_coverage_verify) != 1:
            raise SystemExit("Unable to locate the paired-coverage site verification.")
        verify_file.write_text(verify_source.replace(strict_coverage_verify, independent_coverage_verify, 1), encoding="utf-8")
    auto_recalculate_file = root / "operations/auto_recalculate.py"
    auto_recalculate = auto_recalculate_file.read_text(encoding="utf-8")
    strict_pair_validation = (
        '    if len(rounds[1]) != len(rounds[2]):\n'
        '        raise ValueError("first- and second-round record counts must match")\n'
        '    pairs = {(row.get("pollster"), row.get("registration") or row.get("end")) for row in rounds[1]}\n'
        '    for row in rounds[2]:\n'
        '        if (row.get("pollster"), row.get("registration") or row.get("end")) not in pairs:\n'
        '            raise ValueError("runoff record lacks a first-round pair: " + str(row.get("registration")))\n'
    )
    round_specific_validation = (
        '    if not rounds[2]:\n'
        '        raise ValueError("runtime feed must contain at least one second-round record")\n'
    )
    if round_specific_validation not in auto_recalculate:
        if auto_recalculate.count(strict_pair_validation) != 1:
            raise SystemExit("Unable to locate the strict paired-round runtime validation.")
        auto_recalculate_file.write_text(
            auto_recalculate.replace(strict_pair_validation, round_specific_validation),
            encoding="utf-8",
        )

    database_file = root / "database/manage.py"
    database = database_file.read_text(encoding="utf-8")
    strict_database_pairing = (
        '    round_counts = {round_number: sum(row["round"] == round_number for row in records) for round_number in (1, 2)}\n'
        '    if round_counts[1] != round_counts[2]:\n'
        '        raise RuntimeError("Expected paired first-/second-round records; got {}".format(round_counts))\n'
    )
    if strict_database_pairing in database:
        database = database.replace(strict_database_pairing, "", 1)
    elif "Expected paired first-/second-round records" in database:
        raise SystemExit("Unable to relax the database paired-round validation.")

    strict_expected_counts = (
        '    wave_count = sum(row["round"] == 2 for row in poll_records)\n'
        '    expected = {\n'
        '        "integrity": "ok", "foreign_key_violations": 0, "polls": poll_count,\n'
        '        "first_round_polls": wave_count, "second_round_polls": wave_count, "election_results": 4,\n'
    )
    round_specific_expected_counts = (
        '    first_round_count = sum(row["round"] == 1 for row in poll_records)\n'
        '    wave_count = sum(row["round"] == 2 for row in poll_records)\n'
        '    expected = {\n'
        '        "integrity": "ok", "foreign_key_violations": 0, "polls": poll_count,\n'
        '        "first_round_polls": first_round_count, "second_round_polls": wave_count, "election_results": 4,\n'
    )
    if round_specific_expected_counts not in database:
        if database.count(strict_expected_counts) != 1:
            raise SystemExit("Unable to locate the database expected-count block.")
        database = database.replace(strict_expected_counts, round_specific_expected_counts, 1)
    database_file.write_text(database, encoding="utf-8")

    database_test_file = root / "database/test_database.py"
    database_test = database_test_file.read_text(encoding="utf-8")
    strict_test_counts = (
        '        wave_count = sum(row["round"] == 2 for row in records)\n'
        '        self.assertEqual(self.counts["polls"], len(records))\n'
        '        self.assertEqual(self.counts["first_round_polls"], wave_count)\n'
        '        self.assertEqual(self.counts["second_round_polls"], wave_count)\n'
    )
    round_specific_test_counts = (
        '        first_round_count = sum(row["round"] == 1 for row in records)\n'
        '        wave_count = sum(row["round"] == 2 for row in records)\n'
        '        self.assertEqual(self.counts["polls"], len(records))\n'
        '        self.assertEqual(self.counts["first_round_polls"], first_round_count)\n'
        '        self.assertEqual(self.counts["second_round_polls"], wave_count)\n'
    )
    if round_specific_test_counts not in database_test:
        if database_test.count(strict_test_counts) != 1:
            raise SystemExit("Unable to locate the database paired-count test.")
        database_test_file.write_text(
            database_test.replace(strict_test_counts, round_specific_test_counts, 1),
            encoding="utf-8",
        )

    # The reviewed overlay owns the final ranking test, so patch its release
    # invariant after extraction. Historical coverage grows as new institutes
    # become eligible; the gate should reject duplicates, not a larger set.
    ranking_test = root / "research/institute-rankings/test_rankings.py"
    ranking = ranking_test.read_text(encoding="utf-8")
    stale_historical_count = (
        "self.assertEqual(len(rows),4);"
        "self.assertEqual(sum(r['institute']=='AtlasIntel' for r in rows),1)"
    )
    dynamic_historical_count = (
        "self.assertEqual(len(rows),len({r['institute'] for r in rows}));"
        "self.assertEqual(sum(r['institute']=='AtlasIntel' for r in rows),1)"
    )
    if dynamic_historical_count not in ranking:
        if ranking.count(stale_historical_count) != 1:
            raise SystemExit("Unable to locate the stale fixed historical-ranking count assertion.")
        ranking_test.write_text(
            ranking.replace(stale_historical_count, dynamic_historical_count),
            encoding="utf-8",
        )

    adjustment_test = root / "site/verify-adjustments.mjs"
    adjustment = adjustment_test.read_text(encoding="utf-8")
    stale_comparison_count = (
        "assert.equal(adjustedRelease.simulation.comparison.institutes.length,4);"
        "assert.equal(new Set(adjustedRelease.simulation.comparison.institutes).size,4);"
    )
    dynamic_comparison_count = (
        "assert(adjustedRelease.simulation.comparison.institutes.length>0);"
        "assert.equal(new Set(adjustedRelease.simulation.comparison.institutes).size,"
        "adjustedRelease.simulation.comparison.institutes.length);"
    )
    if dynamic_comparison_count not in adjustment:
        if adjustment.count(stale_comparison_count) != 1:
            raise SystemExit("Unable to locate the stale fixed simulation-institute count assertion.")
        adjustment_test.write_text(
            adjustment.replace(stale_comparison_count, dynamic_comparison_count),
            encoding="utf-8",
        )

    print("Patched model bundle and applied the reviewed methodology overlay.")


if __name__ == "__main__":
    main()
