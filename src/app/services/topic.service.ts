import {inject, Injectable, signal} from '@angular/core';
import {Topic, TopicStatus, TopicType, CreateTopicRequest} from '../models/Topic';
import {ApiService} from './api.service';
import {Post} from '../models/Post';
import {NotificationService} from './notification.service';
import {AuthService} from './auth.service';
import {Router} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class TopicService {
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private topicSignal = signal<Topic>({
    id: 0,
    name: '',
    subforum_id: 0,
    date_created: '',
    date_last_post: '',
    author_user_id: 0,
    author_username: '',
    post_number: 0,
    last_post_author_user_id: null,
    last_post_author_username: null,
    type: TopicType.general,
    status: TopicStatus.active,
    episode: null,
    character: null
  });
  readonly topic = this.topicSignal.asReadonly();

  private postsSignal = signal<Post[]>([]);
  readonly posts = this.postsSignal.asReadonly();

  private readonly postsPerPage = 15;

  constructor() {
    this.notificationService.postCreated$.subscribe(event => {
      const currentTopicId = this.topic().id;
      if (event.data.topic_id == currentTopicId) {
        this.handleNewPost(event.data);
      }
    });
  }

  loadTopic(id: number) {
    this.apiService.get<Topic>('topic/get/' + id.toString()).subscribe(data => {
      this.topicSignal.set(data);
    });
  }

  loadPosts(topicId: number, page: number) {
    this.apiService.get<Post[]>(`topic-posts/${topicId}/${page}`).subscribe(data => {
      this.postsSignal.set(data);
    });
  }

  createPost(data: any) {
    return this.apiService.post('post/create', data);
  }

  createTopic(data: CreateTopicRequest) {
    return this.apiService.post('topic/create', data);
  }

  private handleNewPost(post: Post) {
    // Add the new post to the list
    this.postsSignal.update(posts => [...posts, post]);

    // Increment the post count in the topic
    this.topicSignal.update(topic => {
      if (topic) {
        return { ...topic, post_number: topic.post_number + 1 };
      }
      return topic;
    });

    // Check if the current user is the author and redirect if so
    const currentUser = this.authService.currentUser();
    if (currentUser && currentUser.id === post.author_user_id) {
      const totalPosts = this.topic().post_number;
      const lastPage = Math.ceil(totalPosts / this.postsPerPage);
      this.router.navigate(['/viewtopic', this.topic().id], { queryParams: { page: lastPage } });
    }
  }
}
