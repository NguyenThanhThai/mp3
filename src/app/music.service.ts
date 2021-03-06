import { Injectable, Inject } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs';
import { Observable } from 'rxjs/Observable';

import { SiteConfig } from './site-config';
import { Song } from './song';
import * as _ from 'lodash';

const ALBUM_URL_PREFIX = 'https://cors-anywhere.herokuapp.com/http://mp3.zing.vn/json/playlist/get-source/playlist/';

@Injectable()
export class MusicService {
  /**
   * Cache for song's thumbnail url
   */
  private _cache: Map<string, string>;
  private _allSongs: Promise<Song[]>;

  constructor(private http: Http, @Inject('SiteConfig') private siteConfig: SiteConfig) {
    this._cache = new Map();
  }

  loadPlaylists(): Promise<Song[]> {
    if (this._allSongs != null) {
      return this._allSongs;
    }

    return this._allSongs = Promise.all(this.siteConfig.albums.filter(album => album.id).map(album => {
      return this.http.get(ALBUM_URL_PREFIX + album.id).toPromise()
        .then(resp => (resp.json().data as any[]).map(song => <Song>({
          name: song.name,
          artist: song.artist,
          source: song.source_list[0],
          cover: song.cover,
          zmp3Id: song.id,
          albums: [album]
        })));
    })).then((x: Song[][]) => {
      const map: Map<string, Song> = new Map();
      x.forEach((songs: Song[]) => {
        songs.forEach((s: Song) => {
          if (map.has(s.zmp3Id)) {
            map.get(s.zmp3Id).albums.push(s.albums[0]);
          } else {
            map.set(s.zmp3Id, s);
          }
        });
      });
      return _.shuffle(Array.from(map.values()));
    });
  }

  getThumbnail(id: string): Observable<string> {
    let obs: Observable<string>;
    if (this._cache.has(id)) {
      obs = Observable.of(this._cache.get(id));
    } else {
      obs = this.http
        .get('https://cors-anywhere.herokuapp.com/http://m.mp3.zing.vn/bai-hat/Nothing/' + id + '.html')
        .map(r => {
          const url = r.text().match(/url\(\'(.+?)\'\)/)[1];
          this._cache.set(id, url);
          return url;
        });
    }

    obs = obs.switchMap(url => {
      const img = new Image();
      img.src = url;
      return new Promise((res, rej) => {
        img.onload = () => res(url);
        img.onerror = rej;
      });
    });
    return obs;
  }
}
