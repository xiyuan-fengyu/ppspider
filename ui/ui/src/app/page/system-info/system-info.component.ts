import { Component, OnInit } from '@angular/core';
import {SocketIOService} from "../../service/socket-io.service";

@Component({
  selector: 'app-system-info',
  templateUrl: './system-info.component.html',
  styleUrls: ['./system-info.component.css']
})
export class SystemInfoComponent implements OnInit {

  constructor(
    private socketIOService: SocketIOService
  ) {

  }

  ngOnInit() {

  }

}
