declare module "icecast-metadata-player" {
  /** Icecast/Shoutcast ICY metadata values */
  export interface IcyMetadata {
    StreamTitle?: string; // ICY metadata updates are sometimes just an empty string, which will result in an empty object
    StreamUrl?: string; // Sometimes a URL for the cover photo of the currently playing stream, or URI encoded string with artist, album, disc, etc.
    StreamNext?: string; // Sometimes present on newer Shoutcast servers indicating the next song
  }

  /**
   * Icecast Ogg Vorbis Comment metadata values
   *
   * See [xiph.org vorbis comments](https://xiph.org/vorbis/doc/v-comment.html)
   */
  export interface OggMetadata {
    TITLE?: string; // Track/Work name
    VERSION?: string; // The version field may be used to differentiate multiple versions of the same track title in a single collection. (e.g. remix info)
    ALBUM?: string; // The collection name to which this track belongs
    TRACKNUMBER?: string; // The track number of this piece if part of a specific larger collection or album
    ARTIST?: string; // The artist generally considered responsible for the work. In popular music this is usually the performing band or singer. For classical music it would be the composer. For an audio book it would be the author of the original text.
    PERFORMER?: string; // The artist(s) who performed the work. In classical music this would be the conductor, orchestra, soloists. In an audio book it would be the actor who did the reading. In popular music this is typically the same as the ARTIST and is omitted.
    COPYRIGHT?: string; // Copyright attribution, e.g., '2001 Nobody's Band' or '1999 Jack Moffitt'
    LICENSE?: string; // License information, for example, 'All Rights Reserved', 'Any Use Permitted', a URL to a license such as a Creative Commons license (e.g. "creativecommons.org/licenses/by/4.0/"), or similar.
    ORGANIZATION?: string; // Name of the organization producing the track (i.e. the 'record label')
    DESCRIPTION?: string; // A short text description of the contents
    GENRE?: string; // A short text indication of music genre
    DATE?: string; // Date the track was recorded
    LOCATION?: string; // Location where track was recorded
    CONTACT?: string; // Contact information for the creators or distributors of the track. This could be a URL, an email address, the physical address of the producing label.
    ISRC?: string; // ISRC number for the track; see the ISRC intro page for more information on ISRC numbers.
    VENDOR_STRING?: string; // Name and version of the application used to encode the stream
  }

  interface IcecastMetadataPlayerOptions {
    audioElement?: HTMLAudioElement; // default: new Audio();
    retryTimeout?: number; // default: 30;
    retryDelayRate?: number; // default: 0.1;
    retryDelayMin?: number; // default: 0.5;
    retryDelayMax?: number; // default: 2;
    enableLogging?: boolean; // default: false;

    onPlay?: () => void;
    onLoad?: () => void;
    onStreamStart?: () => void;
    onStream?: (streamData: Uint8Array) => void;
    onStreamEnd?: () => void;
    onCodecUpdate?: (codecInformation: object) => void;
    onStop?: () => void;
    onRetry?: () => void;
    onRetryTimeout?: () => void;
    onWarn?: (...messages: [string]) => void;
    onError?: (...messages: [string]) => void;
  }

  /** IcecastMetadataPlayer `options` parameter when there is icy metadata */
  export interface IcecastMetadataPlayerIcyOptions
    extends IcecastMetadataPlayerOptions {
    metadataTypes?: ["icy"];
    icyMetaInt?: number;
    icyDetectionTimeout?: number; // default: 2000;
    onMetadata?: (
      metadata: IcyMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
    onMetadataEnqueue?: (
      metadata: IcyMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
  }

  /** IcecastMetadataPlayer `options` parameter when there is ogg metadata */
  export interface IcecastMetadataPlayerOggOptions
    extends IcecastMetadataPlayerOptions {
    metadataTypes: ["ogg"];
    onMetadata?: (
      metadata: OggMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
    onMetadataEnqueue?: (
      metadata: OggMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
  }

  /** IcecastMetadataPlayer `options` parameter when there is icy and ogg metadata */
  export interface IcecastMetadataPlayerIcyOggOptions
    extends IcecastMetadataPlayerOptions {
    metadataTypes: ["icy", "ogg"];
    icyMetaInt?: number;
    icyDetectionTimeout?: number; // default: 2000;
    onMetadata?: (
      metadata: IcyMetadata & OggMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
    onMetadataEnqueue?: (
      metadata: IcyMetadata & OggMetadata,
      timestampOffset: number,
      timestamp: number
    ) => void;
  }

  /** IcecastMetadataPlayer `options` parameter when there is no metadata */
  export interface IcecastMetadataPlayerNoMetadataOptions
    extends IcecastMetadataPlayerOptions {
    metadataTypes: [];
    onMetadata?: undefined; // metadata callbacks are not allowed if there is no metadata being parsed
    onMetadataEnqueue?: undefined;
  }

  class IcecastMetadataPlayer extends EventTarget {
    /**
     * Tests if the passed in mime-type can be played.
     *
     * Follows the [HTML5MediaElement canPlayType()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType) API:
     *
     * `""` - Cannot play the codec
     *
     * `"maybe"` - Might be able to play the codec
     *
     * `"probably"` - Should be able to play the codec
     */
    static canPlayType(mimeType: string): {
      mediasource: "" | "maybe" | "probably";
      html5: "" | "maybe" | "probably";
    };

    constructor(
      endpoint: string, // HTTP(s) endpoint for the Icecast compatible stream.
      options?:
        | IcecastMetadataPlayerIcyOptions
        | IcecastMetadataPlayerOggOptions
        | IcecastMetadataPlayerIcyOggOptions
        | IcecastMetadataPlayerNoMetadataOptions
    );

    addEventListener(
      type:
        | "play"
        | "load"
        | "streamstart"
        | "stream"
        | "streamend"
        | "metadata"
        | "metadataenqueue"
        | "codecupdate"
        | "stop"
        | "retry"
        | "retrytimeout"
        | "warn"
        | "error",
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ): void;

    removeEventListener(
      type:
        | "play"
        | "load"
        | "streamstart"
        | "stream"
        | "streamend"
        | "metadata"
        | "metadataenqueue"
        | "codecupdate"
        | "stop"
        | "retry"
        | "retrytimeout"
        | "warn"
        | "error",
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean
    ): void;

    /** Returns audio element that is currently attached to this instance */
    get audioElement(): HTMLAudioElement;

    /** Returns the detected or passed in icy metadata interval in number of bytes */
    get icyMetaInt(): number;

    /** Returns the current state of the IcecastMetadataPlayer */
    get state(): "loading" | "playing" | "stopping" | "stopped" | "retrying";

    /** Returns the array of enqueued `metadata` in FIFO order */
    get metadataQueue(): {
      metadata: IcyMetadata & OggMetadata;
      timestampOffset: number;
      timestamp: number;
    }[];

    /** Plays the Icecast Stream */
    play(): Promise<void>;

    /** Stops the Icecast Stream */
    stop(): Promise<void>;

    /** Removes the audio element from this instance and stops the Icecast Stream */
    detachAudioElement(): Promise<void>;
  }

  export default IcecastMetadataPlayer;
}
