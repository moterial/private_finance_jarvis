'use client';

import { RedditPost, Tweet } from '@/lib/types';
import { cn, timeAgo, getSentimentColor, getSentimentBg } from '@/lib/utils';
import { MessageSquare, ArrowUp, Heart, Repeat2, ExternalLink } from 'lucide-react';

interface SocialFeedProps {
  redditPosts: RedditPost[];
  tweets: Tweet[];
}

export default function SocialFeed({ redditPosts, tweets }: SocialFeedProps) {
  return (
    <div className="glass-panel p-4">
      <h3 className="section-title mb-4">Social Media Intelligence</h3>

      <div className="space-y-6">
        {/* Reddit Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-orange-400">R</span>
            </div>
            <span className="text-xs font-semibold text-jarvis-gray-300 uppercase tracking-wider">Reddit</span>
            <span className="text-xs font-mono text-jarvis-gray-600 ml-auto">{redditPosts.length} posts</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {redditPosts.slice(0, 6).map((post, i) => (
              <a
                key={post.id}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2.5 rounded-lg border border-jarvis-gray-800/30 bg-jarvis-darker/30 hover:bg-jarvis-dark/50 transition-all group"
              >
                <p className="text-xs text-jarvis-gray-300 leading-relaxed line-clamp-2 group-hover:text-jarvis-white transition-colors">
                  {post.title}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-mono text-orange-400/70">r/{post.subreddit}</span>
                  <div className="flex items-center gap-1 text-jarvis-gray-600">
                    <ArrowUp className="w-2.5 h-2.5" />
                    <span className="text-xs font-mono">{post.score.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-jarvis-gray-600">
                    <MessageSquare className="w-2.5 h-2.5" />
                    <span className="text-xs font-mono">{post.numComments}</span>
                  </div>
                  {post.tickers.map(t => (
                    <span key={t} className="text-xs font-mono text-jarvis-accent">${t}</span>
                  ))}
                  <span className={cn(
                    'text-xs font-mono uppercase ml-auto',
                    getSentimentColor(post.sentiment)
                  )}>
                    {post.sentiment}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Twitter/X Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">𝕏</span>
            </div>
            <span className="text-xs font-semibold text-jarvis-gray-300 uppercase tracking-wider">X / Twitter</span>
            <span className="text-xs font-mono text-jarvis-gray-600 ml-auto">{tweets.length} tweets</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {tweets.slice(0, 6).map((tweet, i) => (
              <div
                key={tweet.id}
                className="p-2.5 rounded-lg border border-jarvis-gray-800/30 bg-jarvis-darker/30 hover:bg-jarvis-dark/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono text-jarvis-accent">@{tweet.author}</span>
                  {tweet.isVerified && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">{"\u2713"}</span>
                  )}
                  <span className="text-xs font-mono text-jarvis-gray-600 ml-auto">
                    {(tweet.authorFollowers / 1000).toFixed(0)}K followers
                  </span>
                </div>
                <p className="text-xs text-jarvis-gray-300 leading-relaxed line-clamp-2">{tweet.text}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-jarvis-gray-600">
                    <Heart className="w-2.5 h-2.5" />
                    <span className="text-xs font-mono">{tweet.likes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-jarvis-gray-600">
                    <Repeat2 className="w-2.5 h-2.5" />
                    <span className="text-xs font-mono">{tweet.retweets.toLocaleString()}</span>
                  </div>
                  <span className="text-xs font-mono text-jarvis-gray-600">{timeAgo(tweet.created)}</span>
                  <span className={cn(
                    'text-xs font-mono uppercase ml-auto',
                    getSentimentColor(tweet.sentiment)
                  )}>
                    {tweet.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
