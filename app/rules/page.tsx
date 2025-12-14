'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function RulesPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center mb-2">
          <Image
            src="https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png"
            alt="Tee24 Logo"
            width={100}
            height={33}
            className="object-contain opacity-80"
            unoptimized
          />
        </div>
        <button
          onClick={() => router.push('/')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-8 text-center text-black">
            🏆 Tee24 Winter League Rules
          </h1>

          <div className="prose prose-lg max-w-none">
            {/* Overview */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Overview</h2>
              <p className="text-gray-700 mb-4">
                The <strong>Tee24 Winter League</strong> runs two concurrent competitions:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Individual League</strong></li>
                <li><strong>Team League</strong></li>
              </ul>
              <p className="text-gray-700 mt-4">
                When a player submits an individual score, that score counts toward both leagues.
              </p>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Individual League Format */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">1. Individual League Format</h2>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Progressive Handicapping:</strong> Each player's handicap updates weekly based on performance.
                </li>
                <li>
                  <strong>Handicapped Score:</strong> Calculated as <em>raw score – handicap.</em>
                </li>
                <li>
                  <strong>Baseline Handicap:</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Established after the first <strong>3 rounds</strong>.</li>
                    <li>No winners will be announced for the first 3 rounds until all three have been completed.</li>
                  </ul>
                </li>
                <li>
                  <strong>Weekly Winners:</strong> Determined by the lowest <strong>handicapped score</strong>.
                </li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Team League Format */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">2. Team League Format</h2>
              <ul className="space-y-3 text-gray-700">
                <li>Teams are <strong>set after the first 3 rounds</strong>, once handicaps are established.</li>
                <li>Uses <strong>non-handicapped scores.</strong></li>
                <li>
                  <strong>Format: Best Ball, Match Play</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Each hole: lowest individual score from each team is compared.</li>
                    <li>The team with the lower score wins <strong>1 point</strong> for that hole.</li>
                    <li><strong>Ties:</strong> no point awarded (no carryovers).</li>
                  </ul>
                </li>
                <li>Team standings are tracked weekly on the Tee24 leaderboard.</li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Scoring Rules */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">3. Scoring Rules</h2>
              <ul className="space-y-3 text-gray-700">
                <li>
                  <strong>Mulligans:</strong> 1 mulligan allowed per round (must be declared before re-hitting).
                </li>
                <li>
                  <strong>Score Submission:</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>All scores are due by <strong>Sunday at 11:59 PM each week.</strong></li>
                    <li>Late submissions receive a <strong>default score = handicap + 5 strokes.</strong></li>
                  </ul>
                </li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Putting Settings */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">4. Putting Settings</h2>
              <ul className="space-y-3 text-gray-700">
                <li><strong>Clarksville League:</strong> 6-foot gimmes; any putt outside 6 feet = automatic 2-putt.</li>
                <li><strong>Louisville League:</strong> 10-foot gimmes, putts outside of 10' must be putted.</li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* League Schedule */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">5. League Schedule</h2>
              <ul className="space-y-3 text-gray-700">
                <li><strong>Regular Season:</strong> 10 weeks total.</li>
                <li>
                  <strong>Championship Rounds:</strong> Weeks 11 & 12
                  <ul className="list-disc list-inside ml-6 mt-2">
                    <li>Combined scores from both rounds determine the <strong>League Championship winners.</strong></li>
                  </ul>
                </li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Winnings & Prizes */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">6. Winnings & Prizes</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Individual Prizes</h3>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li><strong>Weekly Winner:</strong> $50</li>
                  <li><strong>Regular Season Champion:</strong> $250</li>
                  <li><strong>League Championship Winner:</strong> $500</li>
                  <li><strong>League Runner-Up:</strong> $250</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Team Prizes</h3>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li><strong>League Champion Team:</strong> $250 per player</li>
                  <li><strong>League Runner-Up Team:</strong> $125 per player</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                <p className="text-gray-700 italic">
                  💰 <em>Based on final participation, prize amounts may increase depending on total eligible players.</em>
                </p>
              </div>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Conduct & Facility Rules */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">7. Conduct & Facility Rules</h2>
              <ul className="space-y-3 text-gray-700">
                <li>All rounds must be played at <strong>Tee24 facilities</strong> (Clarksville or Louisville).</li>
                <li>Simulator settings must match official league parameters.</li>
                <li>
                  <strong>Integrity and sportsmanship</strong> are required at all times. Mulligans, replays, and disputes must be declared and reported immediately.
                </li>
                <li>Any scoring discrepancies must be submitted to a league administrator before Sunday night.</li>
              </ul>
            </section>

            <hr className="my-8 border-gray-300" />

            {/* Optional & Admin Notes */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">8. Optional & Admin Notes</h2>
              <p className="text-gray-600 italic mb-4">
                (Recommended for clarity and fairness — optional to include in final printed version)
              </p>
              <ul className="space-y-3 text-gray-700">
                <li><strong>Tiebreakers:</strong> In case of ties for weekly winners, prize money is split evenly.</li>
                <li><strong>Championship Tiebreaker:</strong> Determined by lowest combined back-nine score from Weeks 11–12.</li>
                <li><strong>Technical Issues:</strong> If a bay malfunctions, notify staff immediately. A replay may be scheduled at admin discretion.</li>
                <li><strong>Leaderboard Updates:</strong> Posted weekly in the Tee24 app or on the in-facility display.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

