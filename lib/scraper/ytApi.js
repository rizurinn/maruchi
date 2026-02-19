class YouTubeAPIClient {
    constructor(apiKey) {
        this.apiKey = global.config.apikey.gcloud;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.categoryMap = {
            1: 'Film & Animation',
            2: 'Autos & Vehicles',
            10: 'Music',
            15: 'Pets & Animals',
            17: 'Sports',
            18: 'Short Movies',
            19: 'Travel & Events',
            20: 'Gaming',
            21: 'Videoblogging',
            22: 'People & Blogs',
            23: 'Comedy',
            24: 'Entertainment',
            25: 'News & Politics',
            26: 'Howto & Style',
            27: 'Education',
            28: 'Science & Technology',
            29: 'Nonprofits & Activism',
            30: 'Movies',
            31: 'Anime/Animation',
            32: 'Action/Adventure',
            33: 'Classics',
            34: 'Comedy',
            35: 'Documentary',
            36: 'Drama',
            37: 'Family',
            38: 'Foreign',
            39: 'Horror',
            40: 'Sci-Fi/Fantasy',
            41: 'Thriller',
            42: 'Shorts',
            43: 'Shows',
            44: 'Trailers'
        };
    }

    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/|v\/|e\/|.+\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    getCategoryName(categoryId) {
        const id = parseInt(categoryId);
        return this.categoryMap[id] || `Unknown`;
    }
    
    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    parseDurationToSeconds(duration) {
        if (!duration) return 0;
        
        if (duration.startsWith('PT')) {
            const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
                const hours = parseInt(match[1]) || 0;
                const minutes = parseInt(match[2]) || 0;
                const seconds = parseInt(match[3]) || 0;
                return hours * 3600 + minutes * 60 + seconds;
            }
        }

        const timeParts = duration.split(':').map(part => parseInt(part) || 0);
        if (timeParts.length === 2) {
            return timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3) {
            return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        }
        
        return 0;
    }
    
    formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    async getVideoInfo(youtubeUrl) {
        const videoId = this.extractVideoId(youtubeUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        try {
            const params = new URLSearchParams({
                part: 'snippet,contentDetails,statistics,status',
                id: videoId,
                key: this.apiKey
            });

            const response = await fetch(`${this.baseUrl}/videos?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const video = data.items[0];
                
                return {
                    videoId: video.id,
                    title: video.snippet.title,
                    description: video.snippet.description,
                    channel: { 
                       id: video.snippet.channelId,
                       title: video.snippet.channelTitle
                    },
                    upload: this.formatDate(video.snippet.publishedAt),
                    categoryId: video.snippet.categoryId,
                    category: this.getCategoryName(video.snippet.categoryId),
                    duration: this.formatDuration(this.parseDurationToSeconds(video.contentDetails.duration)),
                    views: this.formatNumber(video.statistics.viewCount || 0),
                    likes: this.formatNumber(video.statistics.likeCount || 0),
                    commentCount: this.formatNumber(video.statistics.commentCount || 0),
                    thumbnail: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high.url,
                    privacyStatus: video.status.privacyStatus,
                    embeddable: video.status.embeddable,
                    videoUrl: youtubeUrl
                };
            } else {
                throw new Error('Video not found');
            }
        } catch (error) {
            throw new Error('API Error: ' +  error.message);
        }
    }

    async search(options = {}) {
        const {
            query = '',
            maxResults = 10,
            order = 'relevance', // relevance, date, rating, viewCount, title
            type = 'video', // video, channel, playlist
            videoDuration = null, // any, short, medium, long
            videoDefinition = null, // any, high, standard
            channelId = null,
            publishedAfter = null,
            publishedBefore = null,
            pageToken = null
        } = options;

        try {
            const params = new URLSearchParams({
                part: 'snippet',
                key: this.apiKey,
                maxResults: maxResults.toString(),
                order,
                type
            });

            if (query) params.append('q', query);
            if (videoDuration) params.append('videoDuration', videoDuration);
            if (videoDefinition) params.append('videoDefinition', videoDefinition);
            if (channelId) params.append('channelId', channelId);
            if (publishedAfter) params.append('publishedAfter', publishedAfter);
            if (publishedBefore) params.append('publishedBefore', publishedBefore);
            if (pageToken) params.append('pageToken', pageToken);

            const response = await fetch(`${this.baseUrl}/search?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                resultsPerPage: data.pageInfo?.resultsPerPage || 0,
                nextPageToken: data.nextPageToken || null,
                prevPageToken: data.prevPageToken || null,
                items: data.items?.map(item => ({
                    type: item.id.kind.replace('youtube#', ''),
                    title: item.snippet.title,
                    description: item.snippet.description,
                    channel: item.snippet.channelTitle,
                    publishedAt: this.formatDate(item.snippet.publishedAt),
                    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    videoUrl: item.id.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null
                })) || []
            };
        } catch (error) {
            throw new Error('Search API Error: ' + error.message);
        }
    }
}

export const ytApi = new YouTubeAPIClient();
